import "@logseq/libs"

function addSpacing(str) {
  const hanzi =
    "[\u2E80-\u2FFF\u31C0-\u31EF\u3300-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]"
  const punc = {
    base: "[@&=_\\$%\\^\\*-\\+/]",
    open: "[\\(\\[\\{‘“]",
    close: "[,\\.\\?!:\\)\\]\\}’”]",
  }
  const latin =
    "[A-Za-z0-9\u00C0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]" +
    "|" +
    punc.base
  const patterns = [
    new RegExp(
      "(" + hanzi + ")((?:<[^>]*>)?" + latin + "|" + punc.open + ")",
      "ig",
    ),
    new RegExp(
      "((?:" + latin + "|" + punc.close + ")(?:<[^>]*>)?)(" + hanzi + ")",
      "ig",
    ),
  ]

  for (const pattern of patterns) {
    str = str.replace(pattern, `$1<span class="kef-char-spacing"></span>$2`)
  }

  return str
}

logseq
  .ready(async () => {
    // Inject CSS.
    logseq.provideStyle(`
			.kef-char-spacing {
				margin-right: 0.1em;
			}
		`)

    // Observer all subsequent mutations.
    const observer = new MutationObserver((mutationList) => {
      for (const mutation of mutationList) {
        for (const node of mutation.addedNodes) {
          const inlineNodes = node.querySelectorAll("span.inline")
          for (const inlineNode of inlineNodes) {
            inlineNode.innerHTML = addSpacing(inlineNode.innerHTML)
          }
        }
      }
    })
    observer.observe(parent.document.querySelector("#app-container"), {
      subtree: true,
      childList: true,
    })

    // Initial processing.
    setTimeout(() => {
      const startupNodes = parent.document.querySelectorAll(
        "#app-container .block-content span.inline",
      )
      for (const node of startupNodes) {
        node.innerHTML = addSpacing(node.innerHTML)
      }
    }, 1000)
  })
  .catch(console.error)
