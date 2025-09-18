export type BoardSubscription = { unsubscribe: () => void };

export const subscribeToBoard = (
  _boardId: string,
  _callback: (data: unknown) => void
): BoardSubscription => {
  console.warn('AppSync subscription not yet implemented');
  return { unsubscribe: () => {} };
};
