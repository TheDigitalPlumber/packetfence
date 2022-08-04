/**
* "$_maintenance_tasks" store module
*/
import Vue from 'vue'
import { computed } from '@vue/composition-api'
import { types } from '@/store'
import api from './_api'

export const useStore = $store => {
  return {
    isLoading: computed(() => $store.getters['$_maintenance_tasks/isLoading']),
    getList: () => $store.dispatch('$_maintenance_tasks/all'),
    getListOptions: () => $store.dispatch('$_maintenance_tasks/options'),
    createItem: params => $store.dispatch('$_maintenance_tasks/createMaintenanceTask', params),
    getItem: params => $store.dispatch('$_maintenance_tasks/getMaintenanceTask', params.id),
    getItemOptions: params => $store.dispatch('$_maintenance_tasks/options', params.id),
    updateItem: params => $store.dispatch('$_maintenance_tasks/updateMaintenanceTask', params),
    deleteItem: params => $store.dispatch('$_maintenance_tasks/deleteMaintenanceTask', params.id),
  }
}

// Default values
const state = () => {
  return {
    cache: {}, // items details
    message: '',
    itemStatus: ''
  }
}

const getters = {
  isWaiting: state => [types.LOADING, types.DELETING].includes(state.itemStatus),
  isLoading: state => state.itemStatus === types.LOADING
}

const actions = {
  getMaintenanceTask: ({ state, commit }, id) => {
    if (state.cache[id]) {
      return Promise.resolve(state.cache[id]).then(cache => JSON.parse(JSON.stringify(cache)))
    }
    commit('ITEM_REQUEST')
    return api.item(id).then(item => {
      commit('ITEM_REPLACED', item)
      return JSON.parse(JSON.stringify(item))
    }).catch((err) => {
      commit('ITEM_ERROR', err.response)
      throw err
    })
  },
  options: ({ commit }, id) => {
    commit('ITEM_REQUEST')
    if (id) {
      return api.itemOptions(id).then(response => {
        commit('ITEM_SUCCESS')
        return response
      }).catch((err) => {
        commit('ITEM_ERROR', err.response)
        throw err
      })
    } else {
      return api.listOptions().then(response => {
        commit('ITEM_SUCCESS')
        return response
      }).catch((err) => {
        commit('ITEM_ERROR', err.response)
        throw err
      })
    }
  },
  createMaintenanceTask: ({ commit }, data) => {
    commit('ITEM_REQUEST')
    return api.create(data).then(response => {
      commit('ITEM_REPLACED', data)
      return response
    }).catch(err => {
      commit('ITEM_ERROR', err.response)
      throw err
    })
  },
  updateMaintenanceTask: ({ commit }, data) => {
    commit('ITEM_REQUEST')
    return api.update(data).then(response => {
      commit('ITEM_REPLACED', data)
      return response
    }).catch(err => {
      commit('ITEM_ERROR', err.response)
      throw err
    })
  },
  deleteMaintenanceTask: ({ commit }, data) => {
    commit('ITEM_REQUEST', types.DELETING)
    return api.delete(data).then(response => {
      commit('ITEM_DESTROYED', data)
      return response
    }).catch(err => {
      commit('ITEM_ERROR', err.response)
      throw err
    })
  },
  enableMaintenanceTask: ({ commit }, data) => {
    commit('ITEM_REQUEST')
    const _data = { id: data.id, status: 'enabled', quiet: true }
    return api.update(_data).then(response => {
      commit('ITEM_ENABLED', _data)
      commit('$_config_maintenance_tasks_searchable/ITEM_UPDATED', { key: 'id', id: data.id, prop: 'status', data: 'enabled' }, { root: true })
      return response
    }).catch(err => {
      commit('ITEM_ERROR', err.response)
      throw err
    })
  },
  disableMaintenanceTask: ({ commit }, data) => {
    commit('ITEM_REQUEST')
    const _data = { id: data.id, status: 'disabled', quiet: true }
    return api.update(_data).then(response => {
      commit('ITEM_DISABLED', _data)
      commit('$_config_maintenance_tasks_searchable/ITEM_UPDATED', { key: 'id', id: data.id, prop: 'status', data: 'disabled' }, { root: true })
      return response
    }).catch(err => {
      commit('ITEM_ERROR', err.response)
      throw err
    })
  }
}

const mutations = {
  ITEM_REQUEST: (state, type) => {
    state.itemStatus = type || types.LOADING
    state.message = ''
  },
  ITEM_REPLACED: (state, data) => {
    state.itemStatus = types.SUCCESS
    Vue.set(state.cache, data.id, JSON.parse(JSON.stringify(data)))
  },
  ITEM_ENABLED: (state, data) => {
    state.itemStatus = types.SUCCESS
    Vue.set(state.cache, data.id, { ...state.cache[data.id], ...data })
  },
  ITEM_DISABLED: (state, data) => {
    state.itemStatus = types.SUCCESS
    Vue.set(state.cache, data.id, { ...state.cache[data.id], ...data })
  },
  ITEM_DESTROYED: (state, id) => {
    state.itemStatus = types.SUCCESS
    Vue.set(state.cache, id, null)
  },
  ITEM_ERROR: (state, response) => {
    state.itemStatus = types.ERROR
    if (response && response.data) {
      state.message = response.data.message
    }
  },
  ITEM_SUCCESS: (state) => {
    state.itemStatus = types.SUCCESS
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
