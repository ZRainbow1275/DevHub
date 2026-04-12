/**
 * Common port-to-service label mapping.
 * Used by PortView and PortFocusPanel to display human-readable service names.
 */

export const COMMON_PORT_LABELS: Record<number, string> = {
  // Standard protocols
  20: 'FTP Data',
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  993: 'IMAPS',
  995: 'POP3S',

  // Databases
  1433: 'MSSQL',
  1521: 'Oracle',
  3306: 'MySQL',
  5432: 'PostgreSQL',
  5672: 'RabbitMQ',
  6379: 'Redis',
  9200: 'Elasticsearch',
  27017: 'MongoDB',

  // Dev servers
  3000: 'Dev Server',
  3001: 'Dev Server',
  4000: 'Dev Server',
  4200: 'Angular',
  4321: 'Astro',
  5000: 'Dev Server',
  5173: 'Vite',
  5174: 'Vite',
  8000: 'Dev Server',
  8080: 'HTTP Alt',
  8443: 'HTTPS Alt',
  8888: 'Jupyter',
  9000: 'PHP-FPM',

  // Infrastructure
  3389: 'RDP',
  9090: 'Prometheus',
}

/**
 * Get the service label for a port number, or null if unknown.
 */
export function getPortLabel(port: number): string | null {
  return COMMON_PORT_LABELS[port] ?? null
}
