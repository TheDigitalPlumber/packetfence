import apiCall from '@/utils/api'

export default {
  list: params => {
    return apiCall.getQuiet('pki/profiles', { params }).then(response => {
      const { data: { items = [] } = {} } = response
      return { items }
    })
  },
  search: params => {
    return apiCall.postQuiet('pki/profiles/search', params).then(response => {
      return response.data
    })
  },
  create: data => {
    const { id, ...rest } = data // strip `id` from isClone
    return apiCall.post('pki/profiles', rest).then(response => {
      const { data: { error } = {} } = response
      if (error) {
        throw error
      } else {
        const { data: { items: { 0: item = {} } = {} } = {} } = response
        return item
      }
    })
  },
  item: id => {
    return apiCall.get(['pki', 'profile', id]).then(response => {
      const { data: { items: { 0: item = {} } = {} } = {} } = response
      return item
    })
  },
  update: data => {
    const { id, ...rest } = data
    return apiCall.patch(['pki', 'profile', id], rest).then(response => {
      const { data: { error } = {} } = response
      if (error) {
        throw error
      } else {
        const { data: { items: { 0: item = {} } = {} } = {} } = response
        return item
      }
    })
  },
  delete: id => {
    return apiCall.delete(['pki', 'profile', id])
  },
  signCsr: data => {
    const { id, csr } = data
    return apiCall.post(['pki', 'profile', id, 'sign_csr'], { csr }).then(response => {
      const { data: { items: { 0: item = {} } = {} } = {} } = response
      return item
    })
  }
}
