<template>
  <b-form @submit.prevent="onLogin">
    <component :is="modal?'b-modal':'b-card'" v-model="showModal"
      static lazy no-close-on-esc no-close-on-backdrop hide-header-close no-body>
      <template v-slot:[headerSlotName]>
        <b-container fluid class="px-0">
          <b-row align-h="between" align-v="center" class="text-nowrap">
            <b-col cols="9" md="9">
              <h4 class="mb-0" v-if="sessionTime" v-t="'Your session will expire soon'" />
              <h4 class="mb-0" v-else v-t="'PacketFence Administration Login'" />
            </b-col>
            <b-col cols="auto" md="auto" class="ml-auto text-right">
              <b-dropdown variant="link" :text="$t(currentLanguage.label)">
                <b-dropdown-item v-for="language in languages" :key="language.locale"
                  :disabled="language.locale === $i18n.locale"
                  @click="setLanguage(language.locale)"
                  >{{ $t(language.label) }}</b-dropdown-item>
              </b-dropdown>
            </b-col>
          </b-row>
        </b-container>
      </template>
      <component :is="modal?'div':'b-card-body'">
        <b-alert :variant="message.level" :show="!!message.text" fade>
          {{ message.text }}
        </b-alert>
        <template v-if="sessionTime == false">
          <b-form-group :label="$t('Username')" label-for="username" label-cols="4" label-cols-md="4" content-cols content-cols-md>
            <b-form-input id="username" type="text" autocomplete="username" v-model="username" v-focus required :readonly="modal" :disabled="isLoading" />
          </b-form-group>
          <b-form-group :label="$t('Password')" label-for="password" label-cols="4" label-cols-md="4" content-cols content-cols-md>
            <b-form-input id="password" type="password" autocomplete="current-password" v-model="password" :disabled="isLoading" required />
          </b-form-group>
        </template>
      </component>
      <template v-slot:[footerSlotName]>
        <b-container fluid class="px-0">
          <b-row align-h="between">
            <b-col cols="auto" md="auto" class="mr-auto">
              <template v-if="sessionTime">
                <b-link variant="outline-secondary" @click="onLogout">{{ $t('Logout now') }}</b-link>
                <b-button class="ml-2" variant="primary" @click="onExtendSession" v-t="'Extend Session'" />
              </template>
              <template v-else>
                <base-button-save type="submit" :isLoading="isLoading" :disabled="!validForm" variant="primary">
                  {{ $t('Login') }}
                </base-button-save>
                <b-link class="ml-2" variant="outline-secondary" @click="onLogout" v-if="modal">{{ $t('Use a different username') }}</b-link>
              </template>
            </b-col>
            <b-col v-if="!sessionTime && ssoEnabled"
              cols="5" md="5" class="text-right">
              <b-button :href="ssoLoginUrl" variant="outline-primary">
                {{ $t(ssoLoginButtonText) }} <icon class="ml-1" name="user-lock" />
              </b-button>
            </b-col>
          </b-row>
        </b-container>
      </template>
    </component>
  </b-form>
</template>

<script>
import {
  BaseButtonSave
} from '@/components/new/'
const components = {
  BaseButtonSave
}

import { focus } from '@/directives'
const directives = {
  focus
}

const props = {
  modal: {
    type: Boolean
  }
}

const EXPIRATION_DELAY = 60 * 1000 // in miliseconds


import { computed, onMounted, ref, toRefs, watch } from '@vue/composition-api'
import i18n, { languages } from '@/utils/locale'
const setup = (props, context) => {

  const {
    modal
  } = toRefs(props)

  const { emit, root: { $router, $store } = {} } = context

  const username = ref('')
  const password = ref('')
  const message = ref({})
  const showModal = ref(false)
  const sessionTime = ref(false)

  const headerSlotName = computed(() => modal.value ? 'modal-header' : 'header')
  const footerSlotName = computed(() => modal.value ? 'modal-footer' : 'footer')
  const isSessionAlive = computed(() => $store.getters['session/getSessionTime']() !== false)
  const isLoading = computed(() => $store.getters['session/isLoading'])
  const validForm = computed(() => username.value.length > 0 && password.value.length > 0 && !isLoading.value)
  const ssoEnabled = computed(() => $store.getters['session/ssoEnabled'])
  const ssoLoginUrl = computed(() => {
    const here = new URL(window.location.href)
    const callback = encodeURIComponent(`${here.origin}${here.pathname}#/login`)
    return `${$store.getters['session/ssoLoginUrl']}?callback=${callback}`
  })
  const ssoLoginButtonText = computed(() => $store.getters['session/ssoLoginButtonText'])

  onMounted(() => {
    if ($router.currentRoute.path === '/logout') {
      $store.dispatch('session/logout').then(() => {
        message.value = { level: 'info', text: i18n.t('You have logged out') }
      })
    }
    else if ($router.currentRoute.path === '/expire' || $router.currentRoute.params.expire) {
      $store.dispatch('session/logout').then(() => {
        message.value = { level: 'warning', text: i18n.t('Your session has expired') }
      })
    }
    else if ($store.state.session.username) {
      username.value = $store.state.session.username
    }
    if (modal.value) {
      // Watch for session state change from external sources
      watch(isSessionAlive, updateSessionTimeVerified)
    }
    $store.dispatch('session/getSsoInfo', true).then(() => {
      if (ssoEnabled.value && 'token' in $router.currentRoute.query) {
        doLogin(null, $router.currentRoute.query.token)
      }
    })
  })

  const doLogin = (username, password) => {
    message.value = {}
    $store.dispatch('session/login', { username, password }).then(response => {
      if (modal.value) {
        updateSessionTime()
        $store.dispatch('notification/status_success', { message: i18n.t('Login successful') })
      }
      emit('login', response)
    }, error => {
      if (error.response) {
        message.value = { level: 'danger', text: error.response.data.message }
      }
      else if (error.request) {
        message.value = { level: 'danger', text: i18n.t('A networking error occurred. Is the API service running?') }
      }
    })
  }

  let sessionTimer
  const onLogin = () => doLogin(username.value, password.value)
  const onExtendSession = () => {
    if (sessionTimer)
      clearTimeout(sessionTimer)
    $store.dispatch('session/getTokenInfo').then(() => {
      updateSessionTimeVerified()
      $store.dispatch('notification/info', { message: i18n.t('Your session has been successfully extended.') })
    }, () => {
      $store.commit('session/EXPIRED')
    })
  }
  const onLogout = () => {
    if (sessionTimer)
      clearTimeout(sessionTimer)
    showModal.value = false
    $router.push('/logout')
  }
  const updateSessionTime = () => {
    sessionTime.value = $store.getters['session/getSessionTime']()
    if (sessionTime.value === false || sessionTime.value < EXPIRATION_DELAY) {
      // Verify with server without affecting the expiration date
      $store.dispatch('session/getTokenInfo', true).catch(() => {
        $store.commit('session/EXPIRED')
      }).finally(() => {
        updateSessionTimeVerified()
      })
    }
    else {
      // Check back later
      showModal.value = false
      clearTimeout(sessionTimer)
      sessionTimer = setTimeout(updateSessionTime, (sessionTime.value - EXPIRATION_DELAY))
    }
  }
  const updateSessionTimeVerified = () => {
    sessionTime.value = $store.getters['session/getSessionTime']()
    username.value = $store.state.session.username
    if (sessionTimer)
      clearTimeout(sessionTimer)
    if (sessionTime.value === false) {
      // Token has expired
      password.value = ''
      message.value = { level: 'warning', text: i18n.t('Your session has expired') }
      showModal.value = !!$store.state.session.token
    }
    else if (sessionTime.value < EXPIRATION_DELAY) {
      // Token will expire soon
      const secs = Math.floor(sessionTime.value / 1000)
      showModal.value = true
      message.value = { level: 'warning', text: i18n.t('Your session will expire in {seconds} seconds', { seconds: secs > 0 ? secs : 0 }) }
      if (secs > 0 && secs % 15 > 0) {
        sessionTimer = setTimeout(updateSessionTimeVerified, 1000) // Update message in 1 second
      } else {
        sessionTimer = setTimeout(updateSessionTime, 1000) // Verify token with server
      }
    }
    else {
      // Check back later
      showModal.value = false
      if (sessionTime.value <= EXPIRATION_DELAY + 5000) {
        // Don't verify token with server if within 5 seconds
        sessionTimer = setTimeout(updateSessionTimeVerified, (sessionTime.value - EXPIRATION_DELAY))
      }
      else {
        sessionTimer = setTimeout(updateSessionTime, (sessionTime.value - EXPIRATION_DELAY))
      }
    }
  }

  const currentLanguage = computed(() => languages.find(language => language.locale === i18n.locale) || languages[0])
  const setLanguage = lang => $store.dispatch('session/setLanguage', { lang })

  return {
    username,
    password,
    validForm,
    message,
    showModal,
    sessionTime,
    isLoading,

    headerSlotName,
    footerSlotName,
    onLogin,
    onLogout,
    onExtendSession,

    languages,
    currentLanguage,
    setLanguage,

    ssoEnabled,
    ssoLoginUrl,
    ssoLoginButtonText
  }
}

// @vue/component
export default {
  name: 'app-login',
  components,
  directives,
  props,
  setup
}
</script>
