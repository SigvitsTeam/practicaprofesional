export const environment = {
  production: true,
  apiUrl: '',
  auth: {
    supabaseUrl: '',
    supabaseAnonKey: '',
    demoEnabled: false,
    demoEmail: '',
    demoPassword: '',
  },
  maps: {
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18,
    smallCountThreshold: 5,
  },
};
