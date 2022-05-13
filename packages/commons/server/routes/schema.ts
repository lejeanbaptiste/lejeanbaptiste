import axios, { AxiosResponse } from 'axios';
import express, { NextFunction, Request, Response, Router } from 'express';

const router = Router();

/**
 * Custom middleware sets Access-Control-Allow headers in the response.
 * @function
 * @param {Object} request The request
 * @param {Object} response The response
 * @param {Function} next Next middleware function
 */
const httpHeaders = (request: Request, response: Response, next: NextFunction) => {
  response.header('Access-Control-Allow-Origin', '*');
  response.header('Access-Control-Allow-Methods', 'GET');
  response.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
};

router.use(express.json());
router.use(httpHeaders);

/**
 * Get the Schema's XML.
 * Calls {@ link @param req.params.url}
 * @name get/xml
 * @function
 * @memberof module:routes/schema
 * @param {Object} params.url The xml schema uri
 * @returns {string} The schema XML
 */
router.get('/xml/:url', async ({ params }, res) => {
  const resourceURL = params.url;
  if (!resourceURL) res.status(204).send();

  const response: AxiosResponse = await axios.get(resourceURL).catch((error) => error);
  if (response.status !== 200) return res.status(204).send();

  res.type('xml').status(200).send(response.data);
});

/**
 * Get the Schema's CSS.
 * Calls {@ link @param req.params.url}
 * @name get/css
 * @function
 * @memberof module:routes/schema
 * @param {Object} params.url The xml schema uri
 * @returns {string} The schema CSS
 */
router.get('/css/:url', async ({ params }, res) => {
  const resourceURL = params.url;
  if (!resourceURL) res.status(204).send();

  const response: AxiosResponse = await axios.get(resourceURL).catch((error) => error);
  if (response.status !== 200) return res.status(204).send();

  res.type('css').status(200).send(response.data);
});

export default router;
