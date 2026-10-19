// Delivery or pickup slots offered for tomorrow. Change this list to change the slots.
export const ORDER_TIME_SLOTS = [
  { id: '07-09', label: '7–9 AM' },
  { id: '09-11', label: '9–11 AM' },
  { id: '16-18', label: '4–6 PM' },
  { id: '18-20', label: '6–8 PM' },
] as const;

export const isKnownTimeSlot = (slotId: string) =>
  ORDER_TIME_SLOTS.some((slot) => slot.id === slotId);
