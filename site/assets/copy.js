// Copy-to-clipboard for install snippets.
(function () {
  var buttons = document.querySelectorAll('[data-copy]')
  Array.prototype.forEach.call(buttons, function (button) {
    button.addEventListener('click', function () {
      var target = document.getElementById(button.getAttribute('data-copy'))
      if (!target) return
      var text = target.textContent || ''
      var done = function () {
        var label = button.textContent
        button.textContent = 'Copied'
        setTimeout(function () { button.textContent = label }, 1500)
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {})
      } else {
        var range = document.createRange()
        range.selectNodeContents(target)
        var selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        try { document.execCommand('copy'); done() } catch (error) {}
        selection.removeAllRanges()
      }
    })
  })
})()
