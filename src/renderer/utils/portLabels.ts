/**
 * Common port-to-service label mapping.
 * Used by PortView and PortFocusPanel to display human-readable service names.
 */

export const COMMON_PORT_LABELS: Record<number, string> = {
  // 标准协议
  20: 'FTP 数据传输',
  21: 'FTP 文件传输',
  22: 'SSH 安全终端',
  23: 'Telnet 远程登录',
  25: 'SMTP 邮件发送',
  53: 'DNS 域名解析',
  67: 'DHCP 服务端',
  68: 'DHCP 客户端',
  69: 'TFTP 简易传输',
  80: 'HTTP 服务',
  110: 'POP3 邮件接收',
  119: 'NNTP 新闻',
  123: 'NTP 时间同步',
  135: 'RPC 端点映射',
  137: 'NetBIOS 名称',
  138: 'NetBIOS 数据报',
  139: 'NetBIOS 会话',
  143: 'IMAP 邮件访问',
  161: 'SNMP 网络管理',
  162: 'SNMP Trap 通知',
  389: 'LDAP 目录服务',
  443: 'HTTPS 安全服务',
  445: 'SMB 文件共享',
  465: 'SMTPS 安全邮件',
  514: 'Syslog 日志服务',
  587: 'SMTP 邮件提交',
  636: 'LDAPS 安全目录',
  993: 'IMAPS 安全邮件',
  995: 'POP3S 安全邮件',

  // 数据库
  1433: 'SQL Server 数据库',
  1521: 'Oracle 数据库',
  3306: 'MySQL 数据库',
  5432: 'PostgreSQL 数据库',
  5672: 'RabbitMQ 消息队列',
  6379: 'Redis 缓存',
  6380: 'Redis (备用)',
  8529: 'ArangoDB 数据库',
  9042: 'Cassandra 数据库',
  9200: 'Elasticsearch 搜索',
  9300: 'Elasticsearch 节点通信',
  11211: 'Memcached 缓存',
  15672: 'RabbitMQ 管理面板',
  27017: 'MongoDB 数据库',
  27018: 'MongoDB (分片)',
  28015: 'RethinkDB 数据库',

  // 开发服务器
  3000: '开发服务 (通用)',
  3001: '开发服务 (备用)',
  4000: '开发服务 (GraphQL)',
  4200: 'Angular 开发服务',
  4321: 'Astro 开发服务',
  5000: '开发服务 (Flask/ASP)',
  5173: 'Vite 开发服务',
  5174: 'Vite 开发服务 (备用)',
  8000: '开发服务 (Django/PHP)',
  8080: 'HTTP 代理/备用',
  8443: 'HTTPS 备用',
  8888: 'Jupyter Notebook',
  9000: 'PHP-FPM 进程管理',
  9229: 'Node.js 调试器',
  24678: 'Vite HMR 热更新',
  35729: 'LiveReload 实时刷新',

  // 基础设施 / DevOps
  2375: 'Docker REST API',
  2376: 'Docker TLS API',
  2379: 'etcd 客户端',
  2380: 'etcd 集群通信',
  3389: 'RDP 远程桌面',
  5601: 'Kibana 日志面板',
  6443: 'Kubernetes API',
  8081: 'Nexus/Proxy 服务',
  9090: 'Prometheus 监控',
  9093: 'Alertmanager 告警',
  9100: 'Node Exporter 指标',
  9418: 'Git 协议',
  10250: 'Kubelet API',
  16686: 'Jaeger 链路追踪',

  // 消息队列 / 中间件
  1883: 'MQTT 消息协议',
  4369: 'Erlang 端口映射',
  9092: 'Kafka 消息代理',
  2181: 'ZooKeeper 协调服务',

  // 代理 / Web 服务器
  8001: 'Kong 管理 API',
  8444: 'Kong 管理 HTTPS',
  9443: 'Portainer HTTPS',
}

/**
 * Get the service label for a port number, or null if unknown.
 */
export function getPortLabel(port: number): string | null {
  return COMMON_PORT_LABELS[port] ?? null
}

// ============ Port Security Classification ============

export type PortSecurityCategory = 'external' | 'privileged' | 'ephemeral' | 'normal'

export interface PortSecurityInfo {
  category: PortSecurityCategory
  label: string
  description: string
}

/**
 * Classify port security characteristics.
 *
 * @param port - Port number
 * @param isExternalFacing - Whether the port is bound to a non-localhost address
 */
export function getPortSecurityInfo(port: number, isExternalFacing: boolean): PortSecurityInfo {
  if (isExternalFacing) {
    return {
      category: 'external',
      label: '外部可访问',
      description: '端口绑定到非本地地址，外部网络可访问'
    }
  }
  if (port < 1024) {
    return {
      category: 'privileged',
      label: '特权端口',
      description: '端口号 < 1024，通常需要管理员权限'
    }
  }
  if (port >= 49152) {
    return {
      category: 'ephemeral',
      label: '临时端口',
      description: '动态/临时分配的端口 (>= 49152)'
    }
  }
  return {
    category: 'normal',
    label: '',
    description: ''
  }
}
