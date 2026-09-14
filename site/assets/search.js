// Client-side catalog filter. Cards are pre-rendered; this only hides and shows them.
(function () {
  var input = document.getElementById('search')
  var grid = document.getElementById('grid')
  var pills = Array.prototype.slice.call(document.querySelectorAll('.pill[data-category]'))
  var empty = document.getElementById('empty')
  var count = document.getElementById('count')
  if (!input || !grid) return

  var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-skill]'))
  var params = new URLSearchParams(window.location.search)
  var state = { q: params.get('q') || '', category: params.get('category') || '' }
  input.value = state.q

  function tokens(text) {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  }

  function matches(card) {
    if (state.category && card.getAttribute('data-category') !== state.category) return false
    if (!state.q) return true
    var haystack = card.getAttribute('data-search') || ''
    var words = tokens(state.q)
    for (var i = 0; i < words.length; i++) {
      if (haystack.indexOf(words[i]) === -1) return false
    }
    return true
  }

  function apply() {
    var visible = 0
    cards.forEach(function (card) {
      var show = matches(card)
      card.hidden = !show
      if (show) visible++
    })
    if (empty) empty.hidden = visible !== 0
    if (count) count.textContent = visible === cards.length ? cards.length + ' skills' : visible + ' of ' + cards.length + ' skills'
    pills.forEach(function (pill) {
      pill.setAttribute('aria-pressed', pill.getAttribute('data-category') === state.category ? 'true' : 'false')
    })
    var next = new URLSearchParams()
    if (state.q) next.set('q', state.q)
    if (state.category) next.set('category', state.category)
    var query = next.toString()
    var url = window.location.pathname + (query ? '?' + query : '') + window.location.hash
    window.history.replaceState(null, '', url)
  }

  var timer = null
  input.addEventListener('input', function () {
    clearTimeout(timer)
    timer = setTimeout(function () {
      state.q = input.value.trim()
      apply()
    }, 120)
  })
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      input.value = ''
      state.q = ''
      apply()
    }
  })
  pills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      var category = pill.getAttribute('data-category')
      state.category = state.category === category ? '' : category
      apply()
    })
  })
  document.addEventListener('keydown', function (event) {
    if (event.key === '/' && document.activeElement !== input) {
      event.preventDefault()
      input.focus()
    }
  })
  apply()
})()
