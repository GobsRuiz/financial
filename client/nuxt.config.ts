import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    'shadcn-nuxt',
    '@pinia/nuxt',
    '@nuxt/fonts',
    '@vee-validate/nuxt',
  ],

  css: ['~/assets/css/tailwind.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  shadcn: {
    prefix: '',
    componentDir: '~/components/ui',
  },

  components: [
    {
      path: '~/components',
      pathPrefix: false,
      ignore: ['~/components/ui/**'],
    },
  ],

  fonts: {
    families: [
      { name: 'Inter', provider: 'google' },
    ],
  },

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3001',
    },
  },
})
