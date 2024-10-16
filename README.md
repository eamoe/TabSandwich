# TabSandwich

## Overview

The **TabSandwich** Chrome extension allows users to store, manage, and organize web links. Users can save the current tab's URL, manually input links with descriptions, and delete a particular link or all stored links. The extension uses localStorage for persistent link storage and provides an easy-to-use interface for accessing saved links.

## Features

* **Save Current Tab**: Click **SAVE TAB** to store the current tab's URL and optionally add a description.
* **Save Input Links**: Enter a URL and a description manually, then click **SAVE INPUT**.
* **Delete a Link**: Double-click the list item to completely remove it from the list.
* **Delete All Links**: Click the **DELETE ALL** button to clear all saved links.
**Persistent Storage**: Links are saved using `localStorage`, so they persist between sessions.

## Usage

1. **Add New Links**: Either by pasting a link or saving the current tab's URL.
2. **View Links**: Links appear in a list. Click on any link to open it in a new tab.
3. **Delete a Link**: Double-click the list item to remove it.
4. **Delete All Links**: Click the delete button to clear all stored links.

## Installation Guide

To install the TabSandwich Chrome Extension, follow these steps:

1. Clone or Download the Repository

```console
git clone https://github.com/eamoe/TabSandwich.git
```

2. Install dependencies and build the project

```console
npm install

npm run build
```

3. Open Chrome Extensions Page

Open Google Chrome and navigate to the extensions page by entering the following URL into your address bar:

```
chrome://extensions/
```

4. Enable Developer Mode

On the Extensions page, toggle the **Developer mode** switch on (located in the top-right corner of the page).

5. Load the Unpacked Extension

Once Developer mode is enabled, click the **Load unpacked** button. In the dialog that opens, select the folder where you cloned or extracted the extension's repository.

6. Verify the Installation

Once the extension is loaded, you should see it in your list of extensions. Its icon will also appear in the Chrome toolbar. Click on the icon to use the TabSandwich extension.

Now, the extension is successfully installed, and you can begin using it to save and manage your links!
