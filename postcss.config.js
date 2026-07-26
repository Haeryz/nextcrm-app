// Tailwind v4 prefixes via Lightning CSS internally, so a separate autoprefixer
// pass is duplicated work on every rebuild.
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
