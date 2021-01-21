"use strict";

const sunburst = Sunburst();
let diff = null;
let tree = null;

(function()
{
    addUploadInputListener();
    addFilterListener();
    addHelpListener();
})();

class DiffTreeNode
{
    /**
     * @param {string} name 
     * @param {DiffTreeNode} parent 
     * @param {integer} depth 
     */
    constructor(name, parent, depth)
    {
        this.name     = name;
        this.parent   = (typeof parent === "undefined" ? null : parent);
        this.depth    = (typeof depth === "undefined" ? 0 : depth);
        this.children = [];
        this.visible  = true;
        this.color    = "transparent";
        this.changes  = [];
        this.value    = 0;
    }

    /**
     * @param {Array} changes
     */
    addChanges(changes)
    {
        for(let change of changes)
        {
            if(change != null && change != '' && this.changes.includes(change) == false)
                this.changes.push(change);
        }

        if(this.parent != null)
        {
            this.parent.addChanges(changes);
        }
    }
}

// ================================= \\

function addUploadInputListener()
{
    document.querySelector('input[type="file"]')
        .addEventListener('change', event =>
        {
            const fileList = event.target.files;
            if(fileList.length > 0 && fileList[0].type.indexOf('text') >= 0)
            {
                readTextFile(fileList[0]);
            }
        });
}

function readTextFile(file)
{
    const reader = new FileReader();
    reader.addEventListener('load', event =>
    {
        diff = event.target.result.split('\n');
        processDiff(diff);
        enableFilterInput();
    });
    reader.readAsText(file);
}

function processDiff(diff)
{
    tree = buildTree(diff);
    colorTree(tree, 0, 360);

    const sunburstContainer = document.getElementById("sunburst");
    clearChildren(sunburstContainer);
    addSunburst(tree, sunburstContainer);

    const folderContainer = document.getElementById("folders");
    clearChildren(folderContainer);
    addFolderStructure(tree, folderContainer);
}

function buildTree(diff)
{
    let tree = new DiffTreeNode("Project");

    for(let lineIndex = 0 ; lineIndex < diff.length ; ++lineIndex)
    {
        buildTreeBranch(tree, diff[lineIndex]);
    }

    tree.value = tree.children.reduce((sum, element) => sum + element.value, 0);
    return tree;
}

function buildTreeBranch(tree, line)
{
    let node              = tree;
    let fileDiff          = line.split('\t');
    let hasChange         = fileDiff.length > 1;
    let change            = hasChange ? fileDiff[0] : null; // Added (A), Copied (C), Deleted (D), Modified (M), Renamed (R)
    let fileSystemEntries = (hasChange ? fileDiff[1] : fileDiff[0]).split('/');

    for (let entryIndex = 0; entryIndex < fileSystemEntries.length; ++entryIndex)
    {
        const child = findOrCreateChildNode(node, fileSystemEntries[entryIndex], entryIndex);
        processChildNode(child, entryIndex == fileSystemEntries.length - 1, change);
        node = child;
    }
}

function findOrCreateChildNode(node, fileSystemEntryName, entryIndex)
{
    let child = node.children.find(c => c.name == fileSystemEntryName);

    if (typeof child === 'undefined')
    {
        child = new DiffTreeNode(fileSystemEntryName, node, entryIndex);
        node.children.push(child);
    }
    return child;
}

function processChildNode(child, isLeaf, change)
{
    child.value++;
    if (isLeaf)
    {
        child.addChanges([change]);
    }
}

// ================================= \\

function addSunburst(tree, sunburstContainer)
{
    const breadcrumb = document.getElementById("breadcrumb");

    //const colors = ["f94144","f3722c","f8961e","f9844a","f9c74f","90be6d","43aa8b","4d908e","577590","277da1"]
    sunburst
        .data(tree)
        .excludeRoot(true)
        .children(node => node.children.filter(child => child.visible))
        .label(element => element.name + "(" + element.value + " files)")
        .tooltipTitle((element, metaData) =>
        {
            let title = metaData.data.name;
            for(let i = 0 ; i < 3 && metaData.parent != null && (typeof metaData.parent !== "undefined") && (metaData.parent.data.name + title).length < 60; ++i)
            {
                title = metaData.parent.data.name + " → " + title;
                metaData = metaData.parent;
            }
            return title;
        })
        .tooltipContent(element => element.value + " files")
        .onClick(node => onNodeClicked(node, sunburst, breadcrumb))
        .color(element => element.color)
        .maxLevels(5)
        .width(sunburstContainer.offsetWidth)
        .height(sunburstContainer.offsetHeight)
        (sunburstContainer);

    onNodeClicked(tree, sunburst, breadcrumb);
}


function onNodeClicked(node, sunburst, breadcrumb)
{
    if(node == null)
    {
        clearBreadcrumb(breadcrumb);
    }
    else
    {
        fillBreadcrumb(node, sunburst, breadcrumb);
    }

    return sunburst.focusOnNode(node);
}

// ================================= \\

function addFolderStructure(tree, parent)
{
    if(tree.children.length > 0)
    {
        createFolder(tree, parent);
    }
    else
    {
        createFileName(tree, parent);
    }
}

function createFolder(node, parent)
{
    const container  = createFolderContainer(parent);
    const folderName = createFolderName(node, container);
    createFolderButtons(node, folderName);
    for(let child of node.children)
    {
        addFolderStructure(child, container) ;
    }
}

function createFolderContainer(parent)
{
    const details = document.createElement("details");
    parent.appendChild(details);

    return details;
}

function createFolderName(node, parent)
{
    let summary = document.createElement("summary");
    let item = createHierarchyItem(node, summary);
    item.innerText += ` (${node.value} files)`;
    parent.appendChild(summary);

    return summary;
}

function createFolderButtons(node, parent)
{
    let visibilityToggle = document.createElement("input");

    visibilityToggle.setAttribute("type", "checkbox");
    visibilityToggle.checked = node.visible;
    visibilityToggle.addEventListener("change", event =>
    {
        node.visible = event.target.checked;
        recalculateParentsValue(node);
        const sunburstContainer = document.getElementById("sunburst");
        clearChildren(sunburstContainer);
        addSunburst(tree, sunburstContainer);
    });

    parent.appendChild(visibilityToggle);
}

function createFileName(node, parent)
{
    let div = document.createElement("div");
    createHierarchyItem(node, div);
    parent.appendChild(div);
}

function createHierarchyItem(node, parent)
{
    let span = document.createElement("span");
    span.classList.add("folder-name");
    span.innerText = node.name;
    parent.appendChild(span);
    if(node.changes.length > 0)
    {
        createChangeTags(node.changes, parent);
    }
    return span;
}

function createChangeTags(changes, parent)
{
    for(let change of changes)
    {
        let span = document.createElement("span");
        span.classList.add("change");
        span.innerText = change;
        switch(change)
        {
            case "A": span.classList.add("change-add");    span.title = "Added"; break;
            case "D": span.classList.add("change-delete"); span.title = "Deleted"; break;
            case "R": span.classList.add("change-rename"); span.title = "Renamed"; break;
            case "M": span.classList.add("change-modify"); span.title = "Modified"; break;
            default: continue;
        }
        parent.appendChild(span);
    }
}

function recalculateParentsValue(node)
{
    if(node.parent == null || typeof node.parent === "undefined")
        return;

    node.parent.value = node.parent.children.reduce((totalValue, element) => element.visible ? totalValue + element.value : totalValue, 0);
    recalculateParentsValue(node.parent);
}

function colorTree(tree, minHue, maxHue)
{
    let childCount = tree.children.length;
    let childMinHue = minHue;
    for(let i = 0 ; i < childCount ; ++i)
    {
        let child = tree.children[i];
        let childMaxHue = lerp(minHue, maxHue, child.value / tree.value);
        let hue = (childMinHue + childMaxHue) * 0.5;
        childMinHue += hue;
        child.color = `hsl(${hue}, 65%, 50%)`;
        colorTree(child, childMinHue, childMaxHue);
    }
}

function enableFilterInput()
{
    document.querySelectorAll('#filter-container input, #filter-container button')
        .forEach(value => value.disabled = false);
}

function clearChildren(node)
{
    while(node.lastElementChild)
    {
        node.removeChild(node.lastElementChild);
    }
}

function lerp(a, b, t)
{
    t = t < 0 ? 0 : t > 1 ? 1 : t
    return a + (b - a) * t;
}

// ================================= \\


function clearBreadcrumb(breadcrumb)
{
    for (let child of breadcrumb.children)
    {
        child.style.display = "none";
    }
}

function fillBreadcrumb(node, sunburst, breadcrumb)
{
    let breadcrumbIndex = 0;
    for(let element = node ; element != null ; element = element.parent)
    {
        let li = null;
        if(breadcrumb.children.length <= breadcrumbIndex)
        {
            li = document.createElement("li");
            li.addEventListener("click", (ev) => onNodeClicked(ev.target.node, sunburst, breadcrumb));
            breadcrumb.appendChild(li);
        }
        else
        {
            li = breadcrumb.children[breadcrumbIndex];
        }
        li.style.display = "initial"
        li.textContent = element.name;
        li.style.backgroundColor = element.color;
        li.node = element;
        breadcrumbIndex++;
    }
    while(breadcrumbIndex < breadcrumb.children.length)
    {
        breadcrumb.children[breadcrumbIndex].style.display = "none";
        breadcrumb.children[breadcrumbIndex++].innerText = "";
    }
}

// ================================= \\

function addFilterListener()
{
    const filterInput = document.getElementById('filter-input');
    const filterButton = document.getElementById('filter-button');
    filterInput.addEventListener("keyup", event =>
    {
        if (event.key === "Enter")
            filter(filterInput.value);
    });
    filterButton.addEventListener("click", event =>
    {
        filter(filterInput.value);
    });
}

function filter(value)
{
    let regexp = new RegExp(value);
    let filteredDiff = value.length > 0
        ? diff.filter(line => regexp.test(line))
        : diff;
    processDiff(filteredDiff);
}

// ================================= \\

function addHelpListener()
{
    let visibleClass  = "visible";
    let helpContainer = document.getElementById("help-container");
    let helpModal     = document.getElementById("help-modal");
    let helpButton    = document.getElementById("help-button");

    helpModal.addEventListener("click", event => helpContainer.classList.remove(visibleClass));
    helpButton.addEventListener("click", event => helpContainer.classList.add(visibleClass));
}
