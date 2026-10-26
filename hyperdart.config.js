import pkg from './package.json' with {type:'json'}

export default {
  name: pkg.name,
  triggers: {
    keywords: ['npm', 'package info', 'packages like', 'compare packages', 'latest version', 'deprecated package'],
  },
  query_format: {
    regex: [
      '(npm( packages?)?|package info) HD_PACKAGES.NPM_PACKAGES',
      '(latest|current) version of HD_PACKAGES.NPM_PACKAGES',
      'compare( npm)?( packages?)? HD_PACKAGES.NPM_PACKAGES(,| vs| versus| and)? HD_PACKAGES.NPM_PACKAGES((,| vs| versus| and)? HD_PACKAGES.NPM_PACKAGES)?',
      '(npm )?(alternatives?( to| for)|packages? (like|similar to)) HD_PACKAGES.NPM_PACKAGES( npm)?',
    ],
  },
  client: {
    location: pkg.module,
    moduleName: pkg.umdName || 'HD' + pkg.name,
    baseURL: '/' + pkg.name,
  },
  format: {
    mainline: true,
    sidebar: true,
  },
  permissions: {},
  info: {
    github: 'https://github.com/<user>/<repo>',
    demovideo: 'https://youtu.be/aWWLAUc7vho'
  },
}
