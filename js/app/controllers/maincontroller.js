/**
 * ownCloud - Music app
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Morris Jobke <hey@morrisjobke.de>
 * @author Pauli Järvinen <pauli.jarvinen@gmail.com>
 * @copyright Morris Jobke 2013, 2014
 * @copyright Pauli Järvinen 2017 - 2020
 */

angular.module('Music').controller('MainController', [
'$rootScope', '$scope', '$timeout', '$window', '$document', 'ArtistFactory', 
'playlistService', 'libraryService', 'inViewService', 'gettextCatalog', 'Restangular',
function ($rootScope, $scope, $timeout, $window, $document, ArtistFactory, 
		playlistService, libraryService, inViewService, gettextCatalog, Restangular) {

	// retrieve language from backend - is set in ng-app HTML element
	gettextCatalog.currentLanguage = $rootScope.lang;

	// Add dark-theme class to the #app element if Nextcloud dark theme detected.
	// Css can then diffentiate the style of the contained elments where necessary.
	if (OC_Music_Utils.darkThemeActive()) {
		$('#app').addClass('dark-theme');
	}

	$rootScope.playing = false;
	$rootScope.playingView = null;
	$scope.currentTrack = null;
	playlistService.subscribe('trackChanged', function(e, listEntry){
		$scope.currentTrack = listEntry.track;
		$scope.currentTrackIndex = playlistService.getCurrentIndex();
	});

	playlistService.subscribe('play', function(e, playingView) {
		// assume that the play started from current view if no other view given
		$rootScope.playingView = playingView || $rootScope.currentView;
	});

	playlistService.subscribe('playlistEnded', function() {
		$rootScope.playingView = null;
		$scope.currentTrack = null;
		$scope.currentTrackIndex = -1;
	});

	$scope.trackCountText = function(playlist) {
		var trackCount = playlist ? playlist.tracks.length : libraryService.getTrackCount();
		return gettextCatalog.getPlural(trackCount, '1 track', '{{ count }} tracks', { count: trackCount });
	};

	$scope.albumCountText = function() {
		var albumCount = libraryService.getAlbumCount();
		return gettextCatalog.getPlural(albumCount, '1 album', '{{ count }} albums', { count: albumCount });
	};

	$scope.folderCountText = function() {
		if (libraryService.foldersLoaded()) {
			var folderCount = libraryService.getAllFolders().length;
			return gettextCatalog.getPlural(folderCount, '1 folder', '{{ count }} folders', { count: folderCount });
		} else {
			return '';
		}
	};

	$scope.loadIndicatorVisible = function() {
		var contentNotReady = ($rootScope.loadingCollection || $rootScope.searchInProgress);
		return $rootScope.loading
			|| (contentNotReady && $rootScope.currentView != '#/settings');
	};

	$scope.update = function() {
		$scope.updateAvailable = false;
		$rootScope.loadingCollection = true;

		$scope.artists = [];
		$rootScope.$emit('artistsUpdating');

		// load the music collection
		ArtistFactory.getArtists().then(function(artists) {
			libraryService.setCollection(artists);
			libraryService.setFolders(null); // invalidate any out-dated folders
			$scope.artists = libraryService.getAllArtists();

			// Emit the event asynchronously so that the DOM tree has already been
			// manipulated and rendered by the browser when obeservers get the event.
			$timeout(function() {
				$rootScope.$emit('artistsLoaded');
			});

			// Load playlist once the collection has been loaded
			Restangular.all('playlists').getList().then(function(playlists) {
				libraryService.setPlaylists(playlists);
				$scope.playlists = libraryService.getAllPlaylists();
				$rootScope.$emit('playlistsLoaded');
			});

			// The "no content"/"click to scan"/"scanning" banner uses "collapsed" layout
			// if there are any tracks already visible
			var collapsiblePopups = $('.emptycontent:not(#noSearchResults)');
			if (libraryService.getTrackCount() > 0) {
				collapsiblePopups.addClass('collapsed');
			} else {
				collapsiblePopups.removeClass('collapsed');
			}

			$rootScope.loadingCollection = false;

			// check the availability of unscanned files after the collection has been loaded,
			// unless we are already in the middle of scanning (and intermediate results were just loaded)
			if (!$scope.scanning) {
				$scope.updateFilesToScan();
			}
		},
		function(response) { // error handling
			$rootScope.loadingCollection = false;

			var reason = null;
			switch (response.status) {
			case 500:
				reason = gettextCatalog.getString('Internal server error');
				break;
			case 504:
				reason = gettextCatalog.getString('Timeout');
				break;
			default:
				reason = response.status;
				break;
			}
			OC.Notification.showTemporary(
					gettextCatalog.getString('Failed to load the collection: ') + reason);
		});

	};

	// initial loading of artists
	$scope.update();

	var FILES_TO_SCAN_PER_STEP = 10;
	var filesToScan = null;
	var filesToScanIterator = 0;
	var previouslyScannedCount = 0;

	$scope.updateFilesToScan = function() {
		Restangular.one('scanstate').get().then(function(state) {
			previouslyScannedCount = state.scannedCount;
			filesToScan = state.unscannedFiles;
			filesToScanIterator = 0;
			$scope.toScan = (filesToScan.length > 0);
			$scope.scanningScanned = previouslyScannedCount;
			$scope.scanningTotal = previouslyScannedCount + filesToScan.length;
			$scope.noMusicAvailable = ($scope.scanningTotal === 0);
		});
	};

	function processNextScanStep() {
		var sliceEnd = filesToScanIterator + FILES_TO_SCAN_PER_STEP;
		var filesForStep = filesToScan.slice(filesToScanIterator, sliceEnd);
		var params = {
				files: filesForStep.join(','),
				finalize: sliceEnd >= filesToScan.length
		};
		Restangular.all('scan').post(params).then(function(result) {
			// Ignore the results if scanning has been cancelled while we
			// were waiting for the result.
			if ($scope.scanning) {
				filesToScanIterator = sliceEnd;

				if (result.filesScanned || result.coversUpdated) {
					$scope.updateAvailable = true;
				}

				$scope.scanningScanned = previouslyScannedCount + filesToScanIterator;

				if (filesToScanIterator < filesToScan.length) {
					processNextScanStep();
				} else {
					$scope.scanning = false;
				}

				// Update the newly scanned tracks to UI automatically when
				// a) the first batch is ready
				// b) the scanning process is completed.
				// Otherwise the UI state is updated only when the user hits the 'update' button
				if ($scope.updateAvailable && $scope.artists && ($scope.artists.length === 0 || !$scope.scanning)) {
					$scope.update();
				}
			}
		});
	}

	$scope.startScanning = function() {
		$scope.toScan = false;
		$scope.scanning = true;
		processNextScanStep();
	};

	$scope.stopScanning = function() {
		$scope.scanning = false;
	};

	$scope.resetScanned = function() {
		$scope.toScan = false;
		filesToScan = null;
		filesToScanIterator = 0;
		previouslyScannedCount = 0;
	};

	$scope.loadFoldersAndThen = function(callback) {
		if (libraryService.foldersLoaded()) {
			$timeout(callback);
		} else {
			Restangular.one('folders').get().then(function (folders) {
				libraryService.setFolders(folders);
				callback();
			});
		}
	};

	$scope.showSidebar = function(trackId) {
		$rootScope.$emit('showDetails', trackId);
		$('#app-content').addClass('with-app-sidebar');
		$timeout(function() {
			var trackElem = document.getElementById('track-' + trackId);
			if (!isElementInViewPort(trackElem)) {
				$rootScope.$emit('scrollToTrack', trackId, 0);
			}
		}, 300);
	};

	$scope.hideSidebar = function() {
		$rootScope.$emit('hideDetails');
		$('#app-content').removeClass('with-app-sidebar');
		$('#app-content').css('margin-right', '');
	};

	function scrollOffset() {
		var controls = document.getElementById('controls');
		var header = document.getElementById('header');
		var offset = controls ? controls.offsetHeight : 0;
		if (OC_Music_Utils.newLayoutStructure() && header) {
			offset += header.offsetHeight;
		}
		return offset;
	}

	$scope.scrollToItem = function(itemId, animationTime /* optional */) {
		if (itemId) {
			var container = OC_Music_Utils.newLayoutStructure() ? $document : $('#app-content');
			var element = $('#' + itemId);
			if (container && element) {
				if (animationTime === undefined) {
					animationTime = 500;
				}
				container.scrollToElement(element, scrollOffset(), animationTime);
			}
		}
	};

	$scope.scrollToTop = function() {
		var container = OC_Music_Utils.newLayoutStructure() ? $document : $('#app-content');
		container.scrollTo(0, 0);
	};

	// Test if element is at least partially within the view-port
	function isElementInViewPort(el) {
		return inViewService.isElementInViewPort(el, -scrollOffset());
	}

	function setMasterLayout(classes) {
		var missingClasses = _.difference(['tablet', 'mobile', 'portrait'], classes);
		var appContent = $('#app-content');

		_.each(classes, function(cls) {
			appContent.addClass(cls);
		});
		_.each(missingClasses, function(cls) {
			appContent.removeClass(cls);
		});
	}

	$rootScope.$on('resize', function(event, appView) {
		var appViewWidth = appView.outerWidth();

		// Adjust controls bar width to not overlap with the scroll bar.
		// Subtrack one pixel from the width because outerWidth() seems to
		// return rounded integer value which may sometimes be slightly larger
		// than the actual width of the #app-view.
		var controlsWidth = appViewWidth - 1;
		$('#controls').css('width', controlsWidth);
		$('#controls').css('min-width', controlsWidth);

		// the "no content"/"click to scan"/"scanning" banner has the same width as controls 
		$('.emptycontent').css('width', controlsWidth);
		$('.emptycontent').css('min-width', controlsWidth);

		// Set the app-content class according to window and view width. This has
		// impact on the overall layout of the app. See mobile.css and tablet.css.
		if ($window.innerWidth <= 570 || appViewWidth <= 500) {
			setMasterLayout(['mobile', 'portrait']);
		}
		else if ($window.innerWidth <= 768) {
			setMasterLayout(['mobile']);
		}
		else if (appViewWidth <= 690) {
			setMasterLayout(['tablet', 'portrait']);
		}
		else if (appViewWidth <= 1024) {
			setMasterLayout(['tablet']);
		}
		else {
			setMasterLayout([]);
		}
	});

	if (OC_Music_Utils.newLayoutStructure()) {
		$('#controls').addClass('taller-header');
	}

	// Work-around for NC14+: The sidebar width has been limited to 500px (normally 27%),
	// but it's not possible to make corresponding "max margin" definition for #app-content
	// in css. Hence, the margin width is limited here.
	var appContent = $('#app-content');
	appContent.resize(function() {
		if (appContent.hasClass('with-app-sidebar')) {
			var sidebarWidth = $('#app-sidebar').outerWidth();
			var viewWidth = $('#header').outerWidth();

			if (sidebarWidth < 0.27 * viewWidth) {
				appContent.css('margin-right', sidebarWidth);
			} else {
				appContent.css('margin-right', '');
			}
		}
		else {
			appContent.css('margin-right', '');
		}
	});

	$scope.scanning = false;
	$scope.scanningScanned = 0;
	$scope.scanningTotal = 0;
}]);
