export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: 'ADMIN' | 'USER';
      };
      // Set by requireApprovedFarmer for farmer requests
      farmerProfileId?: string;
    }
  }
}
