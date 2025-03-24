import { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('API Error:', error);
      
      if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation Error', 
          details: error.errors 
        });
      }
      
      if (error instanceof mongoose.Error.CastError) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid ID format' 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    }
  };
} 