<template>
  <b-alert :show="isModified" variant="warning" fade>
    <h4 class="alert-heading" v-t="'Warning'"/>
    <p>
      {{ $t('Some services must be restarted to load the new settings.') }}
      <span v-html="$t('Creating or modifying the general configuration requires to restart the pfacct and radiusd services.')"></span>
    </p>
    <base-button-service service="pfacct" restart start stop
      :disabled="isLoading" class="mr-1" size="sm"/>
    <base-button-service service="radiusd-acct" restart start stop
      :disabled="isLoading" class="mr-1" size="sm"/>
    <base-button-service service="radiusd-auth" restart start stop
      :disabled="isLoading" class="mr-1" size="sm"/>
    <base-button-service service="radiusd-cli" restart start stop
      :disabled="isLoading" class="mr-1" size="sm"/>
    <base-button-service service="radiusd-eduroam" restart start stop
      :disabled="isLoading" class="mr-1" size="sm"/>
    <base-button-service service="radiusd-load_balancer" restart start stop
      :disabled="isLoading" class="mr-1" size="sm"/>
  </b-alert>
</template>
<script>
import {
  BaseButtonService
} from '@/components/new/'
const components = {
  BaseButtonService
}

const props = {
  isLoading: {
    type: Boolean,
    default: true
  },
  isModified: {
    type: Boolean,
    default: true
  }
}

const setup = () => {}

// @vue/component
export default {
  name: 'alert-services',
  inheritAttrs: false,
  components,
  props,
  setup
}
</script>

