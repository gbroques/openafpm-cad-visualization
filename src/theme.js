export default {
  root: {
    // Light Theme
    '--openafpm-foreground-color': '#323232',
    '--openafpm-view-cube-background': '#DDDDDD',
    '--openafpm-view-cube-foreground': '#7D7D7D',

    // Dark Theme
    "&[data-theme='dark']": {
      '--openafpm-foreground-color': '#FFFFFF',
      '--openafpm-view-cube-background': '#FFFFFF',
      '--openafpm-view-cube-foreground': '#404040',
    },
  },
};
