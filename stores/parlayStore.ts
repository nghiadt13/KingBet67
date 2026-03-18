import { create } from 'zustand';
import { ParlaySelection, BetType } from '@/types/database';

const MAX_SELECTIONS = 8;
const MIN_SELECTIONS = 2;

interface ParlayState {
  selections: ParlaySelection[];
  isSlipOpen: boolean;

  // Actions
  addSelection: (sel: ParlaySelection) => void;
  removeSelection: (matchId: string) => void;
  clearAll: () => void;
  toggleSlip: () => void;
  openSlip: () => void;
  closeSlip: () => void;

  // Computed helpers
  hasSelection: (matchId: string, betType: BetType, betChoice: string) => boolean;
  hasMatchInSlip: (matchId: string) => boolean;
  totalOdds: () => number;
  canPlace: () => boolean;
}

export const useParlayStore = create<ParlayState>((set, get) => ({
  selections: [],
  isSlipOpen: false,

  addSelection: (sel: ParlaySelection) => {
    const { selections } = get();

    // Max selections check
    if (selections.length >= MAX_SELECTIONS) return;

    // Replace if same match already exists (change bet within same match)
    const existing = selections.findIndex((s) => s.matchId === sel.matchId);
    if (existing >= 0) {
      const updated = [...selections];
      updated[existing] = sel;
      set({ selections: updated });
    } else {
      set({ selections: [...selections, sel] });
    }
  },

  removeSelection: (matchId: string) => {
    set((state) => ({
      selections: state.selections.filter((s) => s.matchId !== matchId),
    }));
  },

  clearAll: () => set({ selections: [], isSlipOpen: false }),

  toggleSlip: () => set((state) => ({ isSlipOpen: !state.isSlipOpen })),
  openSlip: () => set({ isSlipOpen: true }),
  closeSlip: () => set({ isSlipOpen: false }),

  hasSelection: (matchId: string, betType: BetType, betChoice: string) => {
    return get().selections.some(
      (s) => s.matchId === matchId && s.betType === betType && s.betChoice === betChoice,
    );
  },

  hasMatchInSlip: (matchId: string) => {
    return get().selections.some((s) => s.matchId === matchId);
  },

  totalOdds: () => {
    const { selections } = get();
    if (selections.length === 0) return 0;
    return selections.reduce((acc, s) => acc * s.odds, 1);
  },

  canPlace: () => {
    const { selections } = get();
    return selections.length >= MIN_SELECTIONS && selections.length <= MAX_SELECTIONS;
  },
}));
