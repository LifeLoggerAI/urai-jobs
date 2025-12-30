import * as admin from "firebase-admin";
import { Request, Response, NextFunction } from "express";

// Extends the Express Request interface to include the user property.
declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken;
    }
  }
}

/**
 * Middleware to verify the Firebase ID token and check for admin custom claims.
 * This protects endpoints that should only be accessible by administrators.
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const { authorization } = req.headers;

  // Check for the Authorization header and ensure it has the "Bearer" scheme.
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).send({ error: "Unauthorized: Missing or invalid Authorization header." });
  }

  // Extract the token from the header.
  const idToken = authorization.split("Bearer ")[1];
  if (!idToken) {
    return res.status(401).send({ error: "Unauthorized: Bearer token is missing." });
  }

  try {
    // Verify the ID token using the Firebase Admin SDK.
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Check for the 'admin' custom claim.
    if (decodedToken.admin !== true) {
      return res.status(403).send({ error: "Forbidden: You do not have administrative privileges." });
    }

    // Attach the decoded token to the request object for use in subsequent handlers.
    req.user = decodedToken;
    return next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res.status(401).send({ error: "Unauthorized: Invalid or expired token." });
  }
};

/**
 * Middleware for service-to-service authentication.
 * It checks for a secret token in the 'X-URAI-SERVICE-TOKEN' header.
 * If the service token is not present, it falls back to the isAdmin check.
 */
export const isServiceOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const serviceToken = req.headers["x-urai-service-token"];

  // If a valid service token is provided, authorize the request.
  if (serviceToken && serviceToken === process.env.URAI_SERVICE_TOKEN) {
    return next();
  }

  // Otherwise, fall back to checking for an admin user.
  return isAdmin(req, res, next);
};
