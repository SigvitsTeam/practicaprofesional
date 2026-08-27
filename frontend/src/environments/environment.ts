export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  auth: {
    supabaseUrl: '',
    supabaseAnonKey: '',
    demoEnabled: true,
    demoEmail: 'demo@sigvits.hn',
    demoPassword: 'SIGVITS2026!',
  },
  maps: {
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18,
    smallCountThreshold: 0,
  },
};
