export interface CreateServerDto {
  nodeId: string;
  templateSlug: string;
  name: string;
  /** Overrides for the template's envSchema defaults. */
  env?: Record<string, string>;
}
