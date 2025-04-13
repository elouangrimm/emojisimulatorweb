# EMOJI SIMULATOR

---

## made by nicky case and slightly edited by elouan grimm

Yeah basically just download this github repository, and host it on some local server. I use the minimalist [http-server](https://www.npmjs.com/package/http-server), but you can also use [MAMP](https://www.mamp.info/en/). (*Simulating The World* is just a bunch of static files, but it needs to be on a server because of some weird browser security issues with XMLHttpRequests)

### Saving your own sims locally

1. Get it running on your own computertron (see above). For the sake of this example, let's assume it's running on `http://localhost:8080/`. (which it will by default, if you use http-server)
2. Go to `http://localhost:8080/`, and make your own sim!
3. Click "export model". Your simulation's data should pop up in a new tab.
4. Save it locally to `[your local folder]/models`, as `[your sim name].json`. (NOTE: the ".json" extension is important!)
5. Finally, to see your own sim in action, go to `http://localhost:8080/?s=[your sim name]`! Voilà! And you can keep editing and exporting from there, just copy-paste the new data to `[your sim name].json`.
