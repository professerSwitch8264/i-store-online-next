// src/lib/keycloak.js
import Keycloak from 'keycloak-js';

export const keycloakConfig = {
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'https://sso-prod.wanthaifoods.com',
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'master',
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'store',
};

const keycloak = typeof window !== 'undefined'
  ? new Keycloak(keycloakConfig)
  : null;

export default keycloak;