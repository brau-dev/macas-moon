export class BookingError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
