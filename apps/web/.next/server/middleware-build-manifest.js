self.__BUILD_MANIFEST = {
  "polyfillFiles": [
    "static/chunks/polyfills.js"
  ],
  "devFiles": [
    "static/chunks/react-refresh.js"
  ],
  "ampDevFiles": [],
  "lowPriorityFiles": [],
  "rootMainFiles": [],
  "pages": {
    "/_app": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_app.js"
    ],
    "/_error": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_error.js"
    ],
    "/projects/[id]": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/projects/[id].js"
    ],
    "/projects/[id]/extract": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/projects/[id]/extract.js"
    ],
    "/projects/[id]/ingest": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/projects/[id]/ingest.js"
    ],
    "/projects/[id]/results/[fileId]": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/projects/[id]/results/[fileId].js"
    ]
  },
  "ampFirstPages": []
};
self.__BUILD_MANIFEST.lowPriorityFiles = [
"/static/" + process.env.__NEXT_BUILD_ID + "/_buildManifest.js",
,"/static/" + process.env.__NEXT_BUILD_ID + "/_ssgManifest.js",

];