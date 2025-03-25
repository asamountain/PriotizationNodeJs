// This file serves as the serverless function entry point for Vercel
import app from '../server.js';

// Make sure to handle CORS properly
export const config = {
  api: {
    bodyParser: false, // Disabling body parsing - let Socket.IO handle this
  },
};

export default app; 