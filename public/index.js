import "@logseq/libs"

const hanzi =
  "[\u2E80-\u2FFF\u31C0-\u31EF\u3300-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F]"
const punc = {
  base: "[@&=_\\$%\\^\\*-\\+/]",
  open: "[\\(\\[\\{'\"]",
  close: "[,\\.\\?!:\\)\\]\\}'\"]",
}
const latin =
  "[A-Za-z0-9\u00C0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF]" +
  "|" +
  punc.base
const patterns = [
  new RegExp("(" + hanzi + ")(" + latin + "|" + punc.open + ")", "ig"),
  new RegExp("(" + latin + "|" + punc.close + ")(" + hanzi + ")", "ig"),
]

function addSpacing(el) {
  const textNodes = Array.from(getTextNodes(el))
  for (let i = 0; i < textNodes.length; i++) {
    const textNode = textNodes[i]
    // Join text with the first character of the next text node for
    // pattern matching.
    const text = `${textNode.data}${textNodes[i + 1]?.data[0] ?? ""}`

    // Find spliting indices.
    const indices = patterns
      .map((p) => Array.from(text.matchAll(p)).map((m) => m.index + 1))
      .reduce((ret, x) => ret.concat(x))
      .sort((a, b) => a - b)

    splitTextNode(textNode, indices, el)
  }
}

function* getTextNodes(node) {
  for (const subnode of node.childNodes) {
    switch (subnode.nodeType) {
      case 3:
        yield subnode
        break
      case 1:
        yield* getTextNodes(subnode)
        break
    }
  }
}

function splitTextNode(node, indices, host) {
  if (!indices?.length) return

  const frag = document.createDocumentFragment()
  let lastNode = node.cloneNode()
  let offset = 0

  for (const index of indices) {
    const len = index - offset
    offset = index

    if (len < lastNode.data.length) {
      frag.appendChild(document.createTextNode(lastNode.data.substring(0, len)))
      const spacing = document.createElement("span")
      spacing.classList.add("kef-char-spacing")
      frag.appendChild(spacing)
      lastNode = document.createTextNode(lastNode.data.substring(len))
    }
  }
  frag.appendChild(lastNode)

  // Calculate where this last spacing should go to.
  if (
    indices[indices.length - 1] >= node.data.length &&
    node.parentElement != null
  ) {
    if (node.parentElement === host) {
      const spacing = document.createElement("span")
      spacing.classList.add("kef-char-spacing")
      frag.appendChild(spacing)
    } else {
      let parent = node.parentElement
      while (parent.parentElement != null && parent.parentElement !== host) {
        if (parent !== parent.parentElement.lastChild) break
        parent = parent.parentElement
      }
      parent.classList.add("kef-char-spacing")
    }
  }

  node.parentNode.replaceChild(frag, node)
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
          if (node.querySelectorAll) {
            const nodes = node.querySelectorAll("span.inline, td, th")
            for (const n of nodes) {
              addSpacing(n)
            }
          }
        }
      }
    })
    observer.observe(parent.document.body, {
      subtree: true,
      childList: true,
    })
  })
  .catch(console.error)
