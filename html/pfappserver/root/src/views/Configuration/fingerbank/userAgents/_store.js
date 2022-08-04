import Vue from 'vue'
import { computed } from '@vue/composition-api'
import { types } from '@/store'
import api from './_api'

export const useStore = $store => {
  return {
    isLoading: computed(() => $store.getters['$_fingerbank/isUserAgentsLoading']),
    createItem: params => $store.dispatch('$_fingerbank/createUserAgent', params),
    getItem: params => $store.dispatch('$_fingerbank/getUserAgent', params.id),
    updateItem: params => $store.dispatch('$_fingerbank/updateUserAgent', params),
    deleteItem: params => $store.dispatch('$_fingerbank/deleteUserAgent', params.id),
  }
}

// Default values
export const state = () => {
  return {
    userAgents: {
      cache: {},
      message: '',
      status: ''
    }
  }
}

export const getters = {
  isUserAgentsWaiting: state => [types.LOADING, types.DELETING].includes(state.userAgents.status),
  isUserAgentsLoading: state => state.userAgents.status === types.LOADING
}

export const actions = {
  userAgents: () => {
    const params = {
      sort: 'id',
      fields: ['id'].join(',')
    }
    return api.list(params).then(response => {
      return response.items
    })
  },
  getUserAgent: ({ state, commit }, id) => {
    if (state.userAgents.cache[id]) {
      return Promise.resolve(state.userAgents.cache[id])
    }
    commit('USER_AGENT_REQUEST')
    return api.item(id).then(item => {
      commit('USER_AGENT_REPLACED', item)
      return JSON.parse(JSON.stringify(item))
    }).catch(err => {
      commit('USER_AGENT_ERROR', err.response)
      throw err
    })
  },
  createUserAgent: ({ commit }, data) => {
    commit('USER_AGENT_REQUEST')
    return api.create(data).then(response => {
      data.id = response.id
      commit('USER_AGENT_REPLACED', data)
      return response
    }).catch(err => {
      commit('USER_AGENT_ERROR', err.response)
      throw err
    })
  },
  updateUserAgent: ({ commit }, data) => {
    commit('USER_AGENT_REQUEST')
    return api.update(data).then(response => {
      commit('USER_AGENT_REPLACED', data)
      return response
    }).catch(err => {
      commit('USER_AGENT_ERROR', err.response)
      throw err
    })
  },
  deleteUserAgent: ({ commit }, id) => {
    commit('USER_AGENT_REQUEST', types.DELETING)
    return api.delete(id).then(response => {
      commit('USER_AGENT_DESTROYED', id)
      return response
    }).catch(err => {
      commit('USER_AGENT_ERROR', err.response)
      throw err
    })
  }
}

export const mutations = {
  USER_AGENT_REQUEST: (state, type) => {
    state.userAgents.status = type || types.LOADING
    state.userAgents.message = ''
  },
  USER_AGENT_REPLACED: (state, data) => {
    state.userAgents.status = types.SUCCESS
    Vue.set(state.userAgents.cache, data.id, data)
  },
  USER_AGENT_DESTROYED: (state, id) => {
    state.userAgents.status = types.SUCCESS
    Vue.set(state.userAgents.cache, id, null)
  },
  USER_AGENT_ERROR: (state, response) => {
    state.userAgents.status = types.ERROR
    if (response && response.data) {
      state.userAgents.message = response.data.message
    }
  }
}
