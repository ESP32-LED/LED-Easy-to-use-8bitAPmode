function getCategory(categoryId) {
    return jsonData?.categories?.find(c => c.id === categoryId);
}

function getItem(categoryId, itemId) {
    const category = getCategory(categoryId);
    if (!category) return null;

    // 従来の構造
    if (category.items) {
        return category.items.find(i => i.id === itemId);
    }

    // groups構造
    if (category.groups) {
        for (const group of category.groups) {
            const item = group.items.find(i => i.id === itemId);
            if (item) return item;
        }
    }

    return null;
}