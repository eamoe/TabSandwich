class Item {
    constructor(url, description, checked) {
        if (!url) {
            throw new Error("Empty url!")
        }
        this.url = url
        this.description = description
        this.checked = checked
        if (!description) {
            this.description = this.url
        }
    }
}

let links = []
const linkInputEl = document.getElementById("link-input-el")
const descriptionInputEl = document.getElementById("description-input-el")
const inputBtn = document.getElementById("input-btn")
const ulEl = document.getElementById("ul-el")
const deleteBtn = document.getElementById("delete-btn")
const localStorageLinks = JSON.parse( localStorage.getItem("links") )
const tabBtn = document.getElementById("tab-btn")

if (localStorageLinks) {
    links = localStorageLinks
    render(links)
}

tabBtn.addEventListener("click", function(){    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        let item = new Item(
                            tabs[0].url,
                            descriptionInputEl.value,
                            false)
        links.push(item)
        localStorage.setItem( "links", JSON.stringify(links) )
        render(links)
    })
})

function render(linksToRender) {
    let listItems = ""
    for (let i = 0; i < linksToRender.length; i++) {
        listItems += `
            <li>
                <a target='_blank' href='${linksToRender[i].url}'>
                    ${linksToRender[i].description}
                </a>
            </li>
        `
    }
    ulEl.innerHTML = listItems
}

deleteBtn.addEventListener("dblclick", function() {
    localStorage.clear()
    links = []
    render(links)
})

inputBtn.addEventListener("click", function() {
    let item
    try {
        linkInputEl.style.backgroundColor = "#ffffff"
        item = new Item(
                        linkInputEl.value,
                        descriptionInputEl.value,
                        false)
        links.push(item)
        linkInputEl.value = ""
        descriptionInputEl.value = ""
        localStorage.setItem( "links", JSON.stringify(links) )
        render(links)
    }
    catch(err) {
        linkInputEl.style.backgroundColor = "#fa8072"
    }
})

// Add a "checked" symbol when clicking on a list item
ulEl.addEventListener('dblclick', function(event) {
    if (event.target.tagName === 'LI') {
        const linkHref = event.target.children[0].getAttribute("href")
        const description = event.target.children[0].textContent.trim()
        const checked = true
        const item = new Item(
                                linkHref,
                                description,
                                checked)

        removeStorageItem(item, localStorageLinks)
    }
}, false)

function removeStorageItem(item, localStorageItems) {
    let newLinks = []
    for (let i = 0; i < localStorageItems.length; i++) {
        const localStorageItem = new Item(
                                            localStorageItems[i].url,
                                            localStorageItems[i].description,
                                            localStorageItems[i].checked)
        if (!(localStorageItem.url === item.url && item.checked === true)) {
            newLinks.push(localStorageItem)
        }
    }
    location.reload()
    localStorage.setItem( "links", JSON.stringify(newLinks) )
    render(newLinks)
}