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
const linksFromLocalStorage = JSON.parse( localStorage.getItem("links") )
const tabBtn = document.getElementById("tab-btn")

if (linksFromLocalStorage) {
    links = linksFromLocalStorage
    render(links)
}

tabBtn.addEventListener("click", function(){    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        let item = new Item(tabs[0].url, descriptionInputEl.value, false)
        links.push(item)
        localStorage.setItem("links", JSON.stringify(links) )
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
        item = new Item(linkInputEl.value, descriptionInputEl.value, false)
        links.push(item)
        linkInputEl.value = ""
        descriptionInputEl.value = ""
        localStorage.setItem("links", JSON.stringify(links) )
        render(links)
    }
    catch(err) {
        linkInputEl.style.backgroundColor = "#fa8072"
    }
})