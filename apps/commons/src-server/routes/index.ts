import { NextFunction, Request, Response, Router } from 'express';

/**
 * It sets the HTTP headers for the response object
 * @param {Request} _req - Request - The incoming request object
 * @param {Response} res - The response object.
 * @param {NextFunction} next - This is a function that is called when the middleware is complete.
 */
const httpHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', ['GET']);
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
};

export const api = Router();
api.use(httpHeaders);

/* Returning the value of the environment variable GA_MEASUREMENT_ID. */
api.get('/ga-measurement-id', (_req, res) => {
  res.status(200).send(process.env.GA_MEASUREMENT_ID);
});

/* A route that returns the value of the environment variable GEONAMES_USERNAME. */
api.get('/geonames-username', (_req, res) => {
  res.status(200).send(process.env.GEONAMES_USERNAME);
});

/* A route that returns the value of the environment variable KEYCLOAK_URL. */
api.get('/keycloak-url', (_req, res) => {
  res.status(200).send(process.env.KEYCLOAK_URL);
});

/* A route that returns the value of the environment variable NSSI_URL. */
api.get('/nssi-url', (_req, res) => {
  res.status(200).send(process.env.NSSI_URL);
});

/* A route that returns the value of the environment variable AUTH-API-URL. */
api.get('/auth-api-url', (_req, res) => {
  res.status(200).send(process.env.AUTH_API_URL);
});
