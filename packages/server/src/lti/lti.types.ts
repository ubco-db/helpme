import {
  Express,
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ltijs = require('ltijs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const Database = require('ltijs-postgresql') as LtiDatabaseType;

export const Provider = ltijs.Provider as ProviderType;

export type LtiRequestCallback = (
  token: IdToken,
  req: ExpressRequest,
  res: ExpressResponse,
  next?: NextFunction,
) => (void | ExpressResponse) | Promise<ExpressResponse | void>;

export type getPlatformFunction = (
  url: string,
  clientId?: string,
  ENCRYPTIONKEY?: string,
  Database?: LtiDatabaseType,
) => Promise<Platform[] | Platform | false>;

export type ProviderType = {
  app: Express;
  Grade: GradeServiceType;
  DeepLinking: DeepLinkingServiceType;
  NamesAndRoles: NamesAndRolesServiceType;
  DynamicRegistration: DynamicRegistationType;
  setup: (
    encryptionkey: string,
    database: DatabaseOptions,
    options: ProviderOptions,
  ) => ProviderType;
  deploy: (options: DeployOptions) => Promise<true | void>;
  close: () => Promise<true | void>;
  onConnect: (callback: LtiRequestCallback) => void;
  onDeepLinking: (callback: LtiRequestCallback) => void;
  onDynamicRegistration: (callback: LtiRequestCallback) => void;
  onSessionTimeout: (callback: LtiRequestCallback) => void;
  onInvalidToken: (callback: LtiRequestCallback) => void;
  onUnregisteredPlatform: (callback: LtiRequestCallback) => void;
  onInactivePlatform: (callback: LtiRequestCallback) => void;
  appRoute: () => string;
  loginRoute: () => string;
  keysetRoute: () => string;
  dynRegRoute: () => string;
  whitelist: (
    ...routes: string[]
  ) => { route: string; method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'ALL' }[];
  registerPlatform: (
    platform: PlatformOptions,
    getPlatform?: getPlatformFunction,
    ENCRYPTIONKEY?: string,
    Database?: LtiDatabaseType,
  ) => Promise<Platform>;
  getPlatform: getPlatformFunction;
  getPlatformById: (id: string) => Promise<Platform | false>;
  updatePlatformById: (
    id: string,
    options: PlatformOptions,
  ) => Promise<Platform>;
  deletePlatform: (url: string, clientId: string) => Promise<true>;
  deletePlatformById: (id: string) => Promise<true>;
  getAllPlatforms: () => Promise<Platform[]>;
  redirect: (
    res: ExpressResponse,
    path: string,
    options: { query: string; newResource: boolean },
  ) => Promise<void>;
};

export class Platform {
  platformUrl: () => Promise<string>;
  platformClientId: () => Promise<string>;
  platformName: () => Promise<string>;
  platformId: () => Promise<string>;
  platformKid: () => Promise<string>;
  platformActive: (active?: boolean) => Promise<boolean>;
  platformPublicKey: () => Promise<string>;
  platformPrivateKey: () => Promise<string>;
  platformAuthConfig: (
    method?: 'RSA_KEY' | 'JWK_KEY' | 'JWK_SET',
    key?: string,
  ) => Promise<AuthConfigType>;
  platformAuthenticationEndpoint: (endpoint?: string) => Promise<string>;
  platformAccessTokenEndpoint: (endpoint?: string) => Promise<string>;
  platformAuthorizationServer: (endpoint?: string) => Promise<string>;
  platformAccessToken: (scopes: string) => Promise<LtiTokenType>;
  platformJSON: () => Promise<{
    id: string;
    url: string;
    clientId: string;
    name: string;
    authenticationEndpoint: string;
    accesstokenEndpoint: string;
    authorizationServer: string;
    authConfig: AuthConfigType;
    publicKey: string;
    active: boolean;
  }>;
  delete: () => Promise<true | void>;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    platformUrl: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    clientId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    authenticationEndpoint: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    accesstokenEndpoint: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    authorizationServer: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    kid: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ENCRYPTIONKEY: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _authConfig: AuthConfigType,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _Database: LtiDatabaseType,
  ) {}
}

export type LtiDatabaseType = any;

export type LtiTokenType = any;

export type PlatformOptions = {
  url: string;
  name: string;
  clientId: string;
  authenticationEndpoint: string;
  accesstokenEndpoint: string;
  authConfig: AuthConfigType;
  authorizationServer?: string;
};

export type AuthConfigType = {
  method: 'RSA_KEY' | 'JWK_KEY' | 'JWK_SET';
  key: string;
};

export type NamesAndRolesServiceType = {
  getMembers: (token: IdToken, options?: getMembersOptions) => Promise<any[]>;
};

export type getMembersOptions = {
  role: string;
  limit: number;
  pages?: number;
  url?: string;
  resourceLinkId?: boolean;
};

export type DeepLinkingServiceType = {
  createDeepLinkingForm: (
    token: IdToken,
    contentItems: any[],
    options?: DeepLinkingOptions,
  ) => Promise<any>;
  createDeepLinkingMessage: (
    token: IdToken,
    contentItems: any[],
    options?: DeepLinkingOptions,
  ) => Promise<any>;
};

export type DeepLinkingOptions = {
  message?: string;
  errMessage?: string;
  log?: string;
  errLog?: string;
};

export type GradeServiceType = {
  getLineItems: (
    token: IdToken,
    options: getLineItemOptions,
    access: AccessTokenType,
  ) => Promise<LineItem[]>;
  createLineItem: (
    token: IdToken,
    item: LineItem,
    options: { resourceLinkId?: boolean },
    access: AccessTokenType,
  ) => Promise<LineItem>;
  getLineItemById: (
    token: IdToken,
    id: string,
    access: AccessTokenType,
  ) => Promise<LineItem>;
  updateLineItemById: (
    token: IdToken,
    id: string,
    item: LineItem,
  ) => Promise<LineItem>;
  deleteLineItemById: (token: IdToken, id: string) => Promise<true>;
  submitScore: (
    token: IdToken,
    id: string,
    score: ScoreType,
  ) => Promise<ScoreType>;
  getScores: (
    token: IdToken,
    id: string,
    options: {
      userId?: string | false;
      limit?: number | false;
      url?: string | false;
    },
  ) => Promise<ScoreType[]>;
};

export type ScoreType = {
  '@context': 'http://purl.imsglobal.org/ctx/lis/v2/Score';
  '@type': 'Score';
  '@id': string;
  scoreGiven: number;
  scoreMaximum: number;
  comment: string;
  activityProgress: string;
  scoreOf: string;
  timestamp: string;
  resultAgent: {
    userId: string;
  };
};

export type LineItem = {
  '@context': [
    string,
    {
      res: string;
    },
  ];
  '@type': string;
  '@id': string;
  label: string;
  reportingMethod: string;
  lineItemOf: {
    '@id': string;
    contextId: string;
  };
  assignedActivity: {
    '@id': string;
    activityId: string;
  };
  scoreConstraints: {
    '@type': string;
    normalMaximum: number;
    extraCreditMaximum: number;
    totalMaximum: number;
  };
  results: string;
};

export type getLineItemOptions = {
  resourceLinkId?: boolean;
  resourceId?: boolean;
  tag?: string | false;
  limit?: number | false;
  id?: string | false;
  label?: string | false;
  url?: string | false;
};

export type AccessTokenType = {
  access_token: string;
  token_type: string;
};

export type DynamicRegistationType = {
  register: (
    openIdUrl: string,
    registrationToken: string,
    options?: DynamicRegistrationSecondaryOptions,
  ) => Promise<any>;
};

export type DynamicRegistrationSecondaryOptions = {
  initiate_login_uri?: string;
  redirect_uris?: string[];
  client_name?: string;
  jwks_uri?: string;
  logo_uri?: string;
  'https://purl.imsglobal.org/spec/lti-tool-configuration'?: {
    domain?: string;
    description?: string;
    target_link_uri?: string;
    custom_parameters?: Record<string, string>;
    messages?: MessageType[];
  };
};

export type MessageType = {
  type: string;
};

export type DeployOptions = {
  port?: number;
  silent?: boolean;
  serverless?: boolean;
};

export type DatabaseOptions = {
  url?: string;
  plugin?: any;
  connection?: {
    user?: string;
    pass?: string;
  };
};

export type ProviderOptions = {
  appUrl?: string;
  loginUrl?: string;
  keysetUrl?: string;
  dynRegRoute?: string;
  https?: boolean;
  ssl?: {
    key: string;
    cert: string;
    staticPath: string;
  };
  cors?: boolean;
  serverAddon?: (...params: any[]) => any;
  cookies?: {
    secure?: boolean;
    sameSite?: 'Lax' | 'None';
    domain?: string;
  };
  devMode?: boolean;
  tokenMaxAge?: number;
  dynReg?: DynamicRegistrationOptions;
};

export type DynamicRegistrationOptions = {
  url: string;
  name: string;
  logo: string;
  description: string;
  redirectUris: string[];
  customParameters: Record<string, string>;
  autoActivate?: boolean;
  useDeepLinking?: boolean;
};

export type IdToken = {
  iss: string;
  clientId: string;
  deploymentId: string;
  platformId: string;
  platformInfo: {
    product_family_code: string;
    version: string;
    guid: string;
    name: string;
    description: string;
  };
  user: string;
  userInfo: {
    given_name: string;
    family_name: string;
    name: string;
    email: string;
  };
};
