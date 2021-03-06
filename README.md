# README

[![Build Status](https://secure.travis-ci.org/owncloud/music.png)](http://travis-ci.org/owncloud/music)
[![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/owncloud/music/badges/quality-score.png?s=ddb9090619b6bcf0bf381e87011322dd2514c884)](https://scrutinizer-ci.com/g/owncloud/music/)

<img src="/img/logo/music_logotype_horizontal.svg" alt="logotype" width="60%"/>

## Overview

Music player and server for ownCloud and Nextcloud. Shows audio files stored in your cloud categorized by artists and albums. Supports mp3, and depending on the browser, many other audio formats too. Supports shuffle play and playlists. The Music app also allows serving audio files from your cloud to external applications which are compatible either with Ampache or Subsonic.

The full-screen albums view:
![library view](https://user-images.githubusercontent.com/8565946/43827475-94d34d7c-9b02-11e8-8bf9-9f3d91aa5dab.png)

Music player embedded into the files view:
![files view](https://user-images.githubusercontent.com/8565946/43827500-9f45beb6-9b02-11e8-8884-39ed2f0daa54.png)

## Supported formats

* FLAC (`audio/flac`)
* MP3 (`audio/mpeg`)
* Vorbis in OGG container (`audio/ogg`)
* Opus in OGG container (`audio/ogg` or `audio/opus`)
* WAV (`audio/wav`)
* M4A (`audio/mp4`)
* M4B (`audio/m4b`)

_Note: The audio formats supported vary depending on the browser. Chrome and Firefox should be able to play all the formats listed above. All browsers should be able to play at least the MP3 files._

_Note: The app might be unable to play some particular files on some browsers._


### Detail

The Music app utilizes 2 backend players: Aurora.js and SoundManager2.

SoundManager2 utilizes the browser's built-in codecs. Aurora.js, on the other hand, uses Javascript and HTML5 Audio API to decode and play music and doesn't require codecs from browser. The Music app ships with FLAC and MP3 plugins for Aurora.js. Aurora.js does not work on any version of Internet Explorer and fails to play some MP3 files on other browsers, too.

The Music app uses SoundManager2 if the browser has a suitable codec available for the file in question and Aurora.js otherwise. In practice, Firefox and Chrome use SoundManager2 for all supported audio formats. Chromium uses Aurora.js for MP3 and FLAC and doesn't play any other formats. Edge uses Aurora.js for FLAC and SoundManager2 for everything else (ogg and m4b not supported). Internet Explorer plays MP3 with SoundManager2 and doesn's play any other formats.

## Usage hints

Normally, the Music app detects any new audio files in the filesystem on application start and scans metadata from those to its database tables when the user clicks the prompt. The Music app also detects file removals and modifications on the background and makes the required database changes automatically.

If the database would somehow get corrupted, the user can force it to be rebuilt from scratch by opening the Settings (at the bottom of the left pane) and clicking the option "Reset music collection".

### Commands

If preferred, it is also possible to use the command line tool for the database maintenance as described below. This may be quicker than scanning via the web UI in case of large music library, and optionally allows targeting more than one user at once.

Following commands are available(see script occ in your ownCloud root folder):

#### Scan music files

Scan all audio files not already indexed in the database. Extract metadata from those and insert it to the database. Target either specified user(s) or user group(s) or all users.

	./occ music:scan USERNAME1 USERNAME2 ...
	./occ music:scan --group=USERGROUP1 --group==USERGROUP2 ...
	./occ music:scan --all

All the above commands can be combined with the `--debug` switch, which enables debug output and shows the memory usage of each scan step.

#### Reset scanned metadata

Reset all data stored to the music database. Target either specified user(s) or user group(s) or all users.

**Warning:** This command will erase user-created data! It will remove all playlists as playlists are linked against the track metadata.

	./occ music:reset-database USERNAME1 USERNAME2 ...
	./occ music:reset-database --group=USERGROUP1 --group==USERGROUP2 ...
	./occ music:reset-database --all

#### Reset cache

Music app caches some results for performance reasons. Normally, there should be no reason to reset this cache manually, but it might be desiredable e.g. when running performance tests. Target either specified user(s) or user group(s) or all users.

	./occ music:reset-cache USERNAME1 USERNAME2 ...
	./occ music:reset-cache --group=USERGROUP1 --group==USERGROUP2 ...
	./occ music:reset-cache --all

### Ampache and Subsonic

The URL you need to connect with an Ampache-compatible player is listed in the settings and looks like this:

```
https://cloud.domain.org/index.php/apps/music/ampache
```

This is the common path. Most clients append the last part (`/server/xml.server.php`) automatically. If you have connection problems, try the longer version of the URL with the `/server/xml.server.php` appended.

Similarly, the URL used to connect with a Subsonic-compatible player is listed in the settings and looks like this:

```
https://cloud.domain.org/index.php/apps/music/subsonic
```


#### Authentication

Ampache and Subsonic don't use your ownCloud password for authentication. Instead, you need to use a specifically generated APIKEY with them.
The APIKEY is generated through the Music app settings accessible from the link at the bottom of the left pane within the app. When you create the APIKEY, the application shows also the username you should use on your Ampache/Subsonic client. Typically, this is your ownCloud login name but it may also be an UUID in case you have set up LDAP authentication.

You may use the `/api/settings/userkey/generate` endpoint to programatically generate a random password. The endpoint expects two parameters, `length` (optional) and `description` (mandatory) and returns a JSON response.
Please note that the minimum password length is 10 characters. The HTTP return codes represent also the status of the request.

```
POST /api/settings/userkey/generate
```

Parameters:

```
{
	"length": <length>,
	"description": <description>
}
```

Response (success):

```
HTTP/1.1 201 Created

{
	"id": <userkey_id>,
	"password": <random_password>,
	"description": <description>
}
```

Response (error - no description provided):

```
HTTP/1.1 400 Bad request

{
	"message": "Please provide a description"
}
```

Response (error - error while saving password):

```
HTTP/1.1 500 Internal Server Error

{
	"message": "Error while saving the credentials"
}
```

### Installation

The Music app can be installed using the App Management in ownCloud. Instructions can be found [here](https://doc.owncloud.org/server/8.1/admin_manual/installation/apps_management_installation.html).

After installation, you may want to select a specific sub-folder containing your music files through the settings of the application. This can be useful to prevent unwanted audio files to be included in the music library.

### Known issues

#### Huge music collections

The application's scalability for large music collections has gradually improved as new versions have been released. Still, if the collection is large enough, the application may fail to load. The maximum number of tracks supported depends on your server but should be more than 50'000. Also, when there are tens of thousands of tracks, switching the application views may take pretty long time. For the best performance on huge music collections, Firefox 57.0+ (aka "Quantum") is recommended. On the most recent Music app version, also up-to-date Chrome or Edge browser should perform sufficiently well.

#### Translations

There exist partial translations for the Music app for many languages, but all of them are very much incomplete. The application is translated at https://www.transifex.com/owncloud-org/owncloud/ but most of the strings used in the app are not currently visible on Transifex. This is because of disparity in the localization mechanisms used in the Music app and on ownCloud in general. This issue is followed at https://central.owncloud.org/t/owncloud-music-app-translations/14881 .

#### SMB shares

The Music app may be unable to extract metadata of the files residing on a SMB share. This is because, on some system configurations, it is not possible to use `fseek()` function to seek within the remote files on the SMB share. The `getID3` library used for metadata extraction depends on `fseek()` and will fail on such systems. If the metadata extraction fails, the Music app falls back to deducing the track names from the file names and the album names from the folder names. Whether or not the probelm exists on a system, may depend on the details of the SMB support library on the host computer and the remote computer providing the share.

## Development

### L10n hints

Sometimes translatable strings aren't detected. Try to move the `translate` attribute
more to the beginning of the HTML element.

### Build frontend bundle

All the frontend javascript sources of the Music app, excluding the vendor libraries, are bundled into a single file for deployment. This bundle file is js/public/app.js. Similarly, all the style files of the Music app are budnled into css/public/app.css. Generating these bundles requires `make` and `npm` utilities, and happens by running:

	cd build
	make

To automatically regenerate the bundles whenever the source .js/.css files change, use

	make watch

### Build delivery package

To build the release zip package, run the following commands. This requires the `zip` command line utility.

	cd build
	make release

### Install test dependencies

	composer install

### Run tests

PHP unit tests

	vendor/bin/phpunit --coverage-html coverage-html-unit --configuration tests/php/unit/phpunit.xml tests/php/unit

PHP integration tests

	cd ../..          # owncloud core
	./occ maintenance:install --admin-user admin --admin-pass admin --database sqlite
	./occ app:enable music
	cd apps/music
	vendor/bin/phpunit --coverage-html coverage-html-integration --configuration tests/php/integration/phpunit.xml tests/php/integration

Behat acceptance tests

	cd tests
	cp behat.yml.dist behat.yml
	# add credentials for Ampache API to behat.yml
	../vendor/bin/behat

For the acceptance tests, you need to upload all the tracks from the following zip file: https://github.com/paulijar/music/files/2364060/testcontent.zip

### 3rdparty libs

update JavaScript libraries

	cd js
	bower update

## API

The Music app implements the [Shiva API](https://shiva.readthedocs.org/en/latest/resources/base.html) except the resources `/artists/<int:artist_id>/shows`, `/tracks/<int:track_id>/lyrics` and the meta resources. You can use this API under `https://own.cloud.example.org/index.php/apps/music/api/`.

Beside those mentioned resources, the following additional resources are implemented:

* `/api/log`
* `/api/prepare_collection`
* `/api/collection`
* `/api/folders`
* `/api/file/{fileId}`
* `/api/file/{fileId}/download`
* `/api/file/{fileId}/path`
* `/api/file/{fileId}/info`
* `/api/file/{fileId}/details`
* `/api/scanstate`
* `/api/scan`
* `/api/resetscanned`
* `/api/cover/{hash}`
* Playlist API at `/api/playlists/*`
* Settings API at `/api/settings/*`
* [Ampache API](https://github.com/ampache/ampache/wiki/XML-API) at `/ampache/server/xml.server.php`
* [Subsonic API](http://www.subsonic.org/pages/api.jsp) at `/subsonic/rest/{method}`

### `/api/log`

Allows to log a message to ownCloud defined log system.

	POST /api/log

Parameters:

	{
		"message": "The message to log"
	}

Response:

	{
		"success": true
	}


### `/api/collection`

Returns all artists with nested albums and each album with nested tracks. Each track carries a file ID which can be used to obtain the file path with `/api/file/{fileId}/path`. The front-end converts the path into playable WebDAV link like this: `OC.linkToRemoteBase('webdav') + path`.

	GET /api/collection

Response:

	[
		{
			"id": 2,
			"name": "Blind Guardian",
			"albums": [
				{
					"name": "Nightfall in Middle-Earth",
					"year": 1998,
					"disk" : 1,
					"cover": "/index.php/apps/music/api/album/16/cover",
					"id": 16,
					"tracks": [
						{
							"title": "A Dark Passage",
							"number": 21,
							"artistName": "Blind Guardian",
							"artistId": 2,
							"files": {
								"audio/mpeg": 1001
							},
							"id": 202
						},
						{
							"title": "Battle of Sudden Flame",
							"number": 12,
							"artistName": "Blind Guardian",
							"artistId": 2,
							"files": {
								"audio/mpeg": 1002
							},
							"id": 212
						}
					]
				}
			]
		},
		{
			"id": 3,
			"name": "blink-182",
			"albums": [
				{
					"name": "Stay Together for the Kids",
					"year": 2002,
					"disk" : 1,
					"cover": "/index.php/apps/music/api/album/22/cover",
					"id": 22,
					"tracks": [
						{
							"title": "Stay Together for the Kids",
							"number": 1,
							"artistName": "blink-182",
							"artistId": 3,
							"files": {
								"audio/ogg": 1051
							},
							"id": 243
						},
						{
							"title": "The Rock Show (live)",
							"number": 2,
							"artistName": "blink-182",
							"artistId": 3,
							"files": {
								"audio/ogg": 1052
							},
							"id": 244
						}
					]
				}
			]
		}
	]
