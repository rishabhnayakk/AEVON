/**
 * Root server file to forward execution to the backend server.
 * This ensures the service runs regardless of whether Render's Start Command 
 * is set to "npm start" or "node server.js".
 */
require('./backend/server.js');
