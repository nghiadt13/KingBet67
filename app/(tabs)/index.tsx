import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  AppState,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { MatchWithTeams, League } from '@/types/database';

const LIVE_POLL_INTERVAL = 30_000; // 30 seconds
const PRIORITY_STATUSES = ['IN_PLAY', 'PAUSED', 'TIMED', 'SCHEDULED'] as const;
const ALL_LEAGUES_ID = '__all_leagues__';
const SCREEN_WIDTH = Dimensions.get('window').width;
const CAROUSEL_AUTO_INTERVAL = 4000; // 4 seconds

// ── Banner data ──────────────────────────────────────────────────
const BANNERS = [
  {
    key: 'parlay',
    title: 'Đặt kèo xiên',
    subtitle: 'Nhân đôi cơ hội chiến thắng!',
    icon: 'casino' as const,
    gradientColors: ['#0d9488', '#065f46', '#022c22'] as const,
    route: '/matches',
    imageUrl: 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=800&q=80',
  },
  {
    key: 'hot',
    title: 'Trận nóng hôm nay',
    subtitle: 'Xem ngay các trận đấu đang diễn ra',
    icon: 'local-fire-department' as const,
    gradientColors: ['#ea580c', '#dc2626', '#7f1d1d'] as const,
    route: '/matches',
    imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  },
  {
    key: 'standings',
    title: 'Bảng xếp hạng',
    subtitle: 'Cập nhật thứ hạng mới nhất',
    icon: 'emoji-events' as const,
    gradientColors: ['#d97706', '#b45309', '#451a03'] as const,
    route: '/(tabs)/standings',
    imageUrl: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&q=80',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, session, fetchUserProfile } = useAuthStore();
  const [matches, setMatches] = useState<MatchWithTeams[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(ALL_LEAGUES_ID);
  const [leagueFilterEnabled, setLeagueFilterEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Carousel state
  const [activeBanner, setActiveBanner] = useState(0);
  const carouselRef = useRef<ScrollView>(null);
  const carouselTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLeagues = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;

      const leagueData = (data as League[]) || [];

      // Only show leagues that actually have matches in the DB
      const leaguesWithMatches: League[] = [];
      for (const league of leagueData) {
        const { count } = await supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', league.id);
        if (count && count > 0) {
          leaguesWithMatches.push(league);
        }
      }

      setLeagues(leaguesWithMatches);
      setLeagueFilterEnabled(leaguesWithMatches.length > 0);
    } catch {
      // Silent fallback for projects that have not applied multi-league migration yet.
      setLeagues([]);
      setSelectedLeagueId(ALL_LEAGUES_ID);
      setLeagueFilterEnabled(false);
    }
  }, []);

  const fetchMatches = useCallback(async (leagueId: string) => {
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*),
        away_team:teams!matches_away_team_id_fkey(*),
        league:leagues(*)
      `)
      .in('status', [...PRIORITY_STATUSES])
      .order('utc_date', { ascending: true })
      .limit(30);

    if (leagueFilterEnabled && leagueId !== ALL_LEAGUES_ID) {
      query = query.eq('league_id', leagueId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const rows = (data as unknown as MatchWithTeams[]) || [];
    const statusPriority: Record<string, number> = {
      IN_PLAY: 0,
      PAUSED: 1,
      TIMED: 2,
      SCHEDULED: 3,
    };

    rows.sort((a, b) => {
      const pa = statusPriority[a.status] ?? 99;
      const pb = statusPriority[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime();
    });

    setMatches(rows);
  }, [leagueFilterEnabled]);

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      await fetchLeagues();
    } catch (err) {
      console.error('Error loading leagues:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchLeagues]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {

    const run = async () => {
      try {
        setLoading(true);
        await fetchMatches(selectedLeagueId);
      } catch (err) {
        console.error('Error fetching matches:', err);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [selectedLeagueId, fetchMatches, leagueFilterEnabled]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const tasks: Promise<void>[] = [fetchLeagues(), fetchMatches(selectedLeagueId)];
      if (session) tasks.push(fetchUserProfile());
      await Promise.all(tasks);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchLeagues, fetchMatches, fetchUserProfile, selectedLeagueId, session]);

  const liveMatches = useMemo(
    () => matches.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED'),
    [matches],
  );
  const upcomingMatches = useMemo(
    () => matches.filter((m) => m.status === 'TIMED' || m.status === 'SCHEDULED'),
    [matches],
  );

  // ── Auto-refresh khi có trận live ──────────────────────────────
  const hasLive = liveMatches.length > 0;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Silent refresh – không set loading, không gây flicker
  const silentRefresh = useCallback(async () => {
    try {
      await fetchMatches(selectedLeagueId);
    } catch {
      // swallow – silent background refresh
    }
  }, [fetchMatches, selectedLeagueId]);

  useEffect(() => {
    // Start / stop interval when live status changes
    const startPolling = () => {
      if (intervalRef.current) return; // already running
      intervalRef.current = setInterval(silentRefresh, LIVE_POLL_INTERVAL);
    };
    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (hasLive && appStateRef.current === 'active') {
      startPolling();
    } else {
      stopPolling();
    }

    // Pause khi app background, resume khi foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current !== 'active' && nextState === 'active' && hasLive) {
        // Quay lại foreground → refresh ngay + bật interval
        silentRefresh();
        startPolling();
      } else if (nextState !== 'active') {
        stopPolling();
      }
      appStateRef.current = nextState;
    });

    return () => {
      stopPolling();
      sub.remove();
    };
  }, [hasLive, silentRefresh]);

  // ── Carousel auto-scroll ───────────────────────────────────────
  useEffect(() => {
    carouselTimerRef.current = setInterval(() => {
      setActiveBanner((prev) => {
        const next = (prev + 1) % BANNERS.length;
        carouselRef.current?.scrollTo({ x: next * (SCREEN_WIDTH - 32), animated: true });
        return next;
      });
    }, CAROUSEL_AUTO_INTERVAL);

    return () => {
      if (carouselTimerRef.current) clearInterval(carouselTimerRef.current);
    };
  }, []);

  const onCarouselScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32));
    setActiveBanner(idx);
  }, []);

  const formatBalance = (balance: number) => new Intl.NumberFormat('vi-VN').format(balance) + 'đ';

  const formatMatchTime = (utcDate: string) => {
    const date = new Date(utcDate);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatMatchDate = (utcDate: string) => {
    const date = new Date(utcDate);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Hôm nay';
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return 'Ngày mai';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  if (loading && matches.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.neonGreen} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerLogo}>
            <MaterialIcons name="sports-soccer" size={20} color={Colors.black} />
          </View>
          <Text style={styles.headerTitle}>KingBet67</Text>
        </View>
        <View style={styles.headerRight}>
          {user ? (
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>Số dư</Text>
              <Text style={styles.balanceValue}>{formatBalance(user.balance)}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.balanceContainer}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.balanceLabel}>Khách</Text>
              <Text style={[styles.balanceValue, { fontSize: 11 }]}>Đăng nhập</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.neonGreen}
            colors={[Colors.neonGreen]}
          />
        }
      >
        {/* ── League Logo Carousel ─────────────────────────────── */}
        {leagues.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giải đấu</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.leagueLogoScroll}
            >
              <TouchableOpacity
                style={[
                  styles.leagueLogoItem,
                  selectedLeagueId === ALL_LEAGUES_ID && styles.leagueLogoItemActive,
                ]}
                onPress={() => setSelectedLeagueId(ALL_LEAGUES_ID)}
              >
                <View
                  style={[
                    styles.leagueLogoCircle,
                    selectedLeagueId === ALL_LEAGUES_ID && styles.leagueLogoCircleActive,
                  ]}
                >
                  <MaterialIcons
                    name="sports-soccer"
                    size={24}
                    color={selectedLeagueId === ALL_LEAGUES_ID ? Colors.neonGreen : Colors.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.leagueLogoLabel,
                    selectedLeagueId === ALL_LEAGUES_ID && styles.leagueLogoLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  Tất cả
                </Text>
              </TouchableOpacity>

              {leagues.map((league) => (
                <TouchableOpacity
                  key={league.id}
                  style={[
                    styles.leagueLogoItem,
                    selectedLeagueId === league.id && styles.leagueLogoItemActive,
                  ]}
                  onPress={() => setSelectedLeagueId(league.id)}
                >
                  <View
                    style={[
                      styles.leagueLogoCircle,
                      selectedLeagueId === league.id && styles.leagueLogoCircleActive,
                    ]}
                  >
                    {league.emblem_url ? (
                      <Image source={{ uri: league.emblem_url }} style={styles.leagueLogoImage} />
                    ) : (
                      <MaterialIcons name="sports-soccer" size={24} color={Colors.textMuted} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.leagueLogoLabel,
                      selectedLeagueId === league.id && styles.leagueLogoLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {league.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Banner Carousel ──────────────────────────────────── */}
        <View style={styles.carouselSection}>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onCarouselScroll}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH - 32}
            snapToAlignment="center"
            contentContainerStyle={{ paddingHorizontal: 0 }}
          >
            {BANNERS.map((banner) => (
              <TouchableOpacity
                key={banner.key}
                activeOpacity={0.9}
                onPress={() => router.push(banner.route as any)}
                style={styles.bannerWrapper}
              >
                <View style={styles.bannerCard}>
                  <Image
                    source={{ uri: banner.imageUrl }}
                    style={styles.bannerBgImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={[...banner.gradientColors.map(c => c + 'CC')] as [string, string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bannerGradientOverlay}
                  />
                  <View style={styles.bannerContent}>
                    <View style={styles.bannerTextCol}>
                      <Text style={styles.bannerTitle}>{banner.title}</Text>
                      <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
                    </View>
                    <View style={styles.bannerIconWrap}>
                      <MaterialIcons name={banner.icon} size={48} color="rgba(255,255,255,0.25)" />
                    </View>
                  </View>
                  <View style={styles.bannerCta}>
                    <Text style={styles.bannerCtaText}>Xem ngay</Text>
                    <MaterialIcons name="arrow-forward" size={14} color={Colors.white} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Pagination dots */}
          <View style={styles.dotsRow}>
            {BANNERS.map((b, i) => (
              <View
                key={b.key}
                style={[styles.dot, i === activeBanner && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* ── Live Matches ────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.liveDot} />
              <Text style={styles.sectionTitle}>Trực tiếp</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/matches')}>
              <Text style={styles.linkText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>

          {liveMatches.length === 0 && (
            <View style={styles.emptySection}>
              <MaterialIcons name="live-tv" size={20} color={Colors.textMuted} />
              <Text style={styles.emptySectionText}>Không có trận trực tiếp</Text>
            </View>
          )}

          {liveMatches.slice(0, 2).map((match) => (
            <TouchableOpacity
              key={match.id}
              style={styles.liveCard}
              onPress={() => router.push(`/match/${match.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.liveCardHeader}>
                <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>Trực tiếp</Text></View>
                <Text style={styles.leagueLabel}>{match.league?.name || 'League'}</Text>
              </View>
              <View style={styles.liveTeamsRow}>
                <View style={styles.teamCol}>
                  {match.home_team?.crest_url ? (
                    <Image source={{ uri: match.home_team.crest_url }} style={styles.teamLogoLarge} />
                  ) : (
                    <View style={[styles.teamLogoLarge, styles.teamLogoPlaceholder]}>
                      <MaterialIcons name="shield" size={24} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.teamNameLive} numberOfLines={1}>{match.home_team?.short_name || 'Home'}</Text>
                </View>
                <View style={styles.scoreCenterCol}>
                  <Text style={styles.scoreText}>{match.home_score ?? 0} - {match.away_score ?? 0}</Text>
                </View>
                <View style={styles.teamCol}>
                  {match.away_team?.crest_url ? (
                    <Image source={{ uri: match.away_team.crest_url }} style={styles.teamLogoLarge} />
                  ) : (
                    <View style={[styles.teamLogoLarge, styles.teamLogoPlaceholder]}>
                      <MaterialIcons name="shield" size={24} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.teamNameLive} numberOfLines={1}>{match.away_team?.short_name || 'Away'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Upcoming Matches ────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sắp diễn ra</Text>
            <TouchableOpacity onPress={() => router.push('/matches')}>
              <Text style={styles.linkText}>Mở tab trận đấu</Text>
            </TouchableOpacity>
          </View>

          {upcomingMatches.length === 0 && (
            <View style={styles.emptySection}>
              <MaterialIcons name="event" size={20} color={Colors.textMuted} />
              <Text style={styles.emptySectionText}>Không có trận sắp diễn ra</Text>
            </View>
          )}

          {upcomingMatches.slice(0, 4).map((match) => (
            <TouchableOpacity
              key={match.id}
              style={styles.upcomingCard}
              onPress={() => router.push(`/match/${match.id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.upcomingLeft}>
                <View style={styles.timeBox}>
                  <Text style={styles.timeText}>{formatMatchTime(match.utc_date)}</Text>
                  <Text style={styles.dateText}>{formatMatchDate(match.utc_date)}</Text>
                </View>
                <View style={styles.teamsColumnContainer}>
                  <View style={styles.teamRow}>
                    <Text style={styles.teamNameSmall} numberOfLines={1}>{match.home_team?.short_name || 'Home'}</Text>
                  </View>
                  <View style={styles.teamRow}>
                    <Text style={styles.teamNameSmall} numberOfLines={1}>{match.away_team?.short_name || 'Away'}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.leagueCode}>{match.league?.code ?? '---'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.darkBg },
  loadingContainer: { flex: 1, backgroundColor: Colors.darkBg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: 'rgba(11,17,32,0.85)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.neonGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { color: Colors.white, fontSize: 19, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  balanceContainer: { alignItems: 'flex-end' },
  balanceLabel: { fontSize: 9, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 },
  balanceValue: { color: Colors.neonGreen, fontWeight: '700', fontSize: 15 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.liveRed },
  linkText: { color: Colors.neonGreen, fontSize: 12, fontWeight: '600' },

  // ── League Logo Carousel ────────────────────────────────────
  leagueLogoScroll: { paddingTop: 10, paddingRight: 16, gap: 12 },
  leagueLogoItem: { alignItems: 'center', gap: 6, width: 64 },
  leagueLogoItemActive: {},
  leagueLogoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(30,41,59,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(100,116,139,0.2)',
  },
  leagueLogoCircleActive: {
    borderColor: Colors.neonGreen,
    backgroundColor: 'rgba(173,255,47,0.08)',
  },
  leagueLogoImage: { width: 32, height: 32, borderRadius: 4 },
  leagueLogoLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  leagueLogoLabelActive: { color: Colors.neonGreen },

  // ── Banner Carousel ─────────────────────────────────────────
  carouselSection: { marginTop: 16, paddingHorizontal: 16 },
  bannerWrapper: { width: SCREEN_WIDTH - 32 },
  bannerCard: {
    borderRadius: 18,
    padding: 20,
    minHeight: 130,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  bannerBgImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  bannerGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  bannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bannerTextCol: { flex: 1, paddingRight: 8 },
  bannerTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 18,
  },
  bannerIconWrap: { opacity: 0.7, marginTop: -4 },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bannerCtaText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(100,116,139,0.4)',
  },
  dotActive: {
    width: 20,
    backgroundColor: Colors.neonGreen,
    borderRadius: 3,
  },

  // ── Match cards ─────────────────────────────────────────────
  liveCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.2)',
  },
  liveCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  liveBadge: { backgroundColor: Colors.liveRed, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  liveBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  leagueLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  liveTeamsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  teamCol: { flex: 1, alignItems: 'center', gap: 8 },
  teamLogoLarge: { width: 48, height: 48, borderRadius: 24 },
  teamLogoPlaceholder: { backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  teamNameLive: { color: Colors.white, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  scoreCenterCol: { flex: 1, alignItems: 'center' },
  scoreText: { color: Colors.white, fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  upcomingCard: {
    backgroundColor: 'rgba(22,31,50,0.5)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.12)',
    marginBottom: 8,
  },
  upcomingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  timeBox: { width: 42, alignItems: 'center' },
  timeText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  dateText: { color: Colors.textMuted, fontSize: 9, marginTop: 1 },
  teamsColumnContainer: { flex: 1, gap: 5 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamNameSmall: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  leagueCode: { color: Colors.neonGreen, fontWeight: '700', fontSize: 12 },
  emptySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    marginBottom: 12,
  },
  emptySectionText: { color: Colors.textMuted, fontSize: 13 },
});
