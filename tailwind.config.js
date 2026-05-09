export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif']
      },
      colors: {
        midnight: '#050816',
        panel: 'rgba(15, 23, 42, 0.68)'
      },
      boxShadow: {
        neon: '0 0 34px rgba(91, 141, 255, 0.32)'
      }
    }
  },
  plugins: []
};
