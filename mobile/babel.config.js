module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // "@/..." = depo kökü (paylaşılan saf modüller: lib/, content/, messages/). SPEC-MOBILE M1.
      ["module-resolver", { root: ["./"], alias: { "@": "../" } }],
    ],
  };
};
