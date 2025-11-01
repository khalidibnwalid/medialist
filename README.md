<div align="center">
    <img
        src="./docs/assets/logo_with_bg.svg"
        width="120"
        height="120"
    >
    <h1 style="font-weight: 700"> MediaList</h1>
    <p>
        MediaList is a self-hosted home for collectors and enthusiasts, where every item page is fully customizable to create the perfect media collection.
    </p>
</div>

<div>
    <img
        src="./docs/assets/items.webp"
        width="100%"
    />
    <img
        src="./docs/assets/item_page.webp"
        width="24%"
    />
     <img
        src="./docs/assets/headers.webp"
        width="24%"
    />
     <img
        src="./docs/assets/fields.webp"
        width="24%"
    />
     <img
        src="./docs/assets/lists.webp"
        width="24%"
    />
</div>

## Installation

You can install it directly from Docker by running:

```bash
docker run --name medialist -p 3000:3000 -e PORT=3000 -e DATABASE_PATH=db/sqlite.db -v medialist:/app/public/users -v medialist:/app/db khalidibnwalid/medialist
```

For more details, see [Installation Guide](https://github.com/khalidibnwalid/medialist/wiki/Installation)

## Contribution

Consider supporting the project by starring the repository!
You can contribute by reporting bugs or suggesting new features through issues.

If you're a developer looking to get involved, check out the [Contributing Guide](./docs/CONTRIBUTING.md).
