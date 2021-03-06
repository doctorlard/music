<?php

/**
 * ownCloud - Music app
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Morris Jobke <hey@morrisjobke.de>
 * @copyright Morris Jobke 2013, 2014
 */

namespace OCA\Music\Db;

use \OCA\Music\Utility\Util;

use OCP\IDBConnection;

class AlbumMapper extends BaseMapper {
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'music_albums', '\OCA\Music\Db\Album');
	}

	/**
	 * @param string $condition
	 * @return string
	 */
	private function makeSelectQuery($condition=null) {
		return 'SELECT * FROM `*PREFIX*music_albums` `album`'.
			'WHERE `album`.`user_id` = ? ' . $condition;
	}

	/**
	 * returns all albums of a user
	 *
	 * @param string $userId the user ID
	 * @param integer $sortBy sort order of the result set
	 * @param integer $limit
	 * @param integer $offset
	 * @return Album[]
	 */
	public function findAll($userId, $sortBy=SortBy::None, $limit=null, $offset=null) {
		$sql = $this->makeSelectQuery(
				$sortBy == SortBy::Name ? 'ORDER BY LOWER(`album`.`name`)' : null);
		$params = [$userId];
		return $this->findEntities($sql, $params, $limit, $offset);
	}

	/**
	 * returns artist IDs mapped to album IDs
	 * does not include album_artist_id
	 *
	 * @param integer[]|null $albumIds IDs of the albums; get all albums of the user if null given
	 * @param string $userId the user ID
	 * @return array int => int[], keys are albums IDs and values are arrays of artist IDs
	 */
	public function getAlbumArtistsByAlbumId($albumIds, $userId) {
		$sql = 'SELECT DISTINCT `track`.`artist_id`, `track`.`album_id` '.
			'FROM `*PREFIX*music_tracks` `track` '.
			'WHERE `track`.`user_id` = ? ';
		$params = [$userId];

		if ($albumIds !== null) {
			$sql .= 'AND `track`.`album_id` IN ' . $this->questionMarks(\count($albumIds));
			$params = \array_merge($params, $albumIds);
		}

		$result = $this->execute($sql, $params);
		$artists = [];
		while ($row = $result->fetch()) {
			$artists[$row['album_id']][] = $row['artist_id'];
		}
		return $artists;
	}

	/**
	 * returns release years mapped to album IDs
	 *
	 * @param integer[]|null $albumIds IDs of the albums; get all albums of the user if null given
	 * @param string $userId the user ID
	 * @return array int => int[], keys are albums IDs and values are arrays of years
	 */
	public function getYearsByAlbumId($albumIds, $userId) {
		$sql = 'SELECT DISTINCT `track`.`year`, `track`.`album_id` '.
				'FROM `*PREFIX*music_tracks` `track` '.
				'WHERE `track`.`user_id` = ? '.
				'AND `track`.`year` IS NOT NULL ';
		$params = [$userId];

		if ($albumIds !== null) {
			$sql .= 'AND `track`.`album_id` IN ' . $this->questionMarks(\count($albumIds));
			$params = \array_merge($params, $albumIds);
		}

		$result = $this->execute($sql, $params);
		$yearsByAlbum = [];
		while ($row = $result->fetch()) {
			$yearsByAlbum[$row['album_id']][] = $row['year'];
		}
		return $yearsByAlbum;
	}

	/**
	 * returns albums of a specified artist
	 * The artist may be an album_artist or the artist of a track
	 *
	 * @param integer $artistId ID of the artist
	 * @param string $userId the user ID
	 * @return Album[]
	 */
	public function findAllByArtist($artistId, $userId) {
		$sql = 'SELECT * FROM `*PREFIX*music_albums` `album` '.
			'WHERE `album`.`id` IN (SELECT DISTINCT `album`.`id` FROM '.
			'`*PREFIX*music_albums` `album` WHERE `album`.`album_artist_id` = ? AND '.
			'`album`.`user_id` = ? UNION SELECT `track`.`album_id` '.
			'FROM `*PREFIX*music_tracks` `track` WHERE `track`.`artist_id` = ? AND '.
			'`track`.`user_id` = ?) ORDER BY LOWER(`album`.`name`)';
		$params = [$artistId, $userId, $artistId, $userId];
		return $this->findEntities($sql, $params);
	}

	/**
	 * returns albums of a specified artist
	 * The artist must album_artist on the album, artists of individual tracks are not considered
	 *
	 * @param integer $artistId ID of the artist
	 * @param string $userId the user ID
	 * @return Album[]
	 */
	public function findAllByAlbumArtist($artistId, $userId) {
		$sql = $this->makeSelectQuery('AND `album`.`album_artist_id` = ?');
		$params = [$userId, $artistId];
		return $this->findEntities($sql, $params);
	}

	/**
	 * returns album that matches a name, a disc number and an album artist ID
	 *
	 * @param string|null $albumName name of the album
	 * @param string|integer|null $discNumber disk number of this album's disk
	 * @param integer|null $albumArtistId ID of the album artist
	 * @param string $userId the user ID
	 * @return Album[]
	 */
	public function findAlbum($albumName, $discNumber, $albumArtistId, $userId) {
		$sql = 'SELECT * FROM `*PREFIX*music_albums` `album` '.
			'WHERE `album`.`user_id` = ? ';
		$params = [$userId];

		// add artist id check
		if ($albumArtistId === null) {
			$sql .= 'AND `album`.`album_artist_id` IS NULL ';
		} else {
			$sql .= 'AND `album`.`album_artist_id` = ? ';
			\array_push($params, $albumArtistId);
		}

		// add album name check
		if ($albumName === null) {
			$sql .= 'AND `album`.`name` IS NULL ';
		} else {
			$sql .= 'AND `album`.`name` = ? ';
			\array_push($params, $albumName);
		}

		// add disc number check
		if ($discNumber === null) {
			$sql .= 'AND `album`.`disk` IS NULL ';
		} else {
			$sql .= 'AND `album`.`disk` = ? ';
			\array_push($params, $discNumber);
		}

		return $this->findEntity($sql, $params);
	}

	/**
	 * @param integer $coverFileId
	 * @param integer $folderId
	 * @return boolean True if one or more albums were influenced
	 */
	public function updateFolderCover($coverFileId, $folderId) {
		$sql = 'SELECT DISTINCT `tracks`.`album_id`
				FROM `*PREFIX*music_tracks` `tracks`
				JOIN `*PREFIX*filecache` `files` ON `tracks`.`file_id` = `files`.`fileid`
				WHERE `files`.`parent` = ?';
		$params = [$folderId];
		$result = $this->execute($sql, $params);

		$updated = false;
		if ($result->rowCount()) {
			$sql = 'UPDATE `*PREFIX*music_albums`
					SET `cover_file_id` = ?
					WHERE `cover_file_id` IS NULL AND `id` IN (?)';
			$params = [$coverFileId, \join(",", $result->fetchAll(\PDO::FETCH_COLUMN))];
			$result = $this->execute($sql, $params);
			$updated = $result->rowCount() > 0;
		}

		return $updated;
	}

	/**
	 * @param integer $coverFileId
	 * @param integer $albumId
	 */
	public function setCover($coverFileId, $albumId) {
		$sql = 'UPDATE `*PREFIX*music_albums`
				SET `cover_file_id` = ?
				WHERE `id` = ?';
		$params = [$coverFileId, $albumId];
		$this->execute($sql, $params);
	}

	/**
	 * @param integer[] $coverFileIds
	 * @param string[]|null $userIds the users whose music library is targeted; all users are targeted if omitted
	 * @return Album[] albums which got modified, empty array if none
	 */
	public function removeCovers($coverFileIds, $userIds=null) {
		// find albums using the given file as cover
		$sql = 'SELECT `id`, `user_id` FROM `*PREFIX*music_albums` WHERE `cover_file_id` IN ' .
			$this->questionMarks(\count($coverFileIds));
		$params = $coverFileIds;
		if ($userIds !== null) {
			$sql .= ' AND `user_id` IN ' . $this->questionMarks(\count($userIds));
			$params = \array_merge($params, $userIds);
		}
		$albums = $this->findEntities($sql, $params);

		// if any albums found, remove the cover from those
		$count = \count($albums);
		if ($count) {
			$sql = 'UPDATE `*PREFIX*music_albums`
				SET `cover_file_id` = NULL
				WHERE `id` IN ' . $this->questionMarks($count);
			$params = Util::extractIds($albums);
			$this->execute($sql, $params);
		}

		return $albums;
	}

	/**
	 * @param string|null $userId target user; omit to target all users
	 * @return array of dictionaries with keys [albumId, userId, parentFolderId]
	 */
	public function getAlbumsWithoutCover($userId = null) {
		$sql = 'SELECT DISTINCT `albums`.`id`, `albums`.`user_id`, `files`.`parent`
				FROM `*PREFIX*music_albums` `albums`
				JOIN `*PREFIX*music_tracks` `tracks` ON `albums`.`id` = `tracks`.`album_id`
				JOIN `*PREFIX*filecache` `files` ON `tracks`.`file_id` = `files`.`fileid`
				WHERE `albums`.`cover_file_id` IS NULL';
		$params = [];
		if ($userId !== null) {
			$sql .= ' AND `albums`.`user_id` = ?';
			$params[] = $userId;
		}
		$result = $this->execute($sql, $params);
		$return = [];
		while ($row = $result->fetch()) {
			$return[] = [
				'albumId' => $row['id'],
				'userId' => $row['user_id'],
				'parentFolderId' => $row['parent']
			];
		}
		return $return;
	}

	/**
	 * @param integer $albumId
	 * @param integer $parentFolderId
	 * @return boolean True if a cover image was found and added for the album
	 */
	public function findAlbumCover($albumId, $parentFolderId) {
		$return = false;
		$coverNames = ['cover', 'albumart', 'front', 'folder'];
		$imagesSql = 'SELECT `fileid`, `name`
					FROM `*PREFIX*filecache`
					JOIN `*PREFIX*mimetypes` ON `*PREFIX*mimetypes`.`id` = `*PREFIX*filecache`.`mimetype`
					WHERE `parent` = ? AND `*PREFIX*mimetypes`.`mimetype` LIKE \'image%\'';
		$params = [$parentFolderId];
		$result = $this->execute($imagesSql, $params);
		$images = $result->fetchAll();
		if (\count($images)) {
			\usort($images, function ($imageA, $imageB) use ($coverNames) {
				$nameA = \strtolower($imageA['name']);
				$nameB = \strtolower($imageB['name']);
				$indexA = PHP_INT_MAX;
				$indexB = PHP_INT_MAX;
				foreach ($coverNames as $i => $coverName) {
					if ($indexA === PHP_INT_MAX && \strpos($nameA, $coverName) === 0) {
						$indexA = $i;
					}
					if ($indexB === PHP_INT_MAX && \strpos($nameB, $coverName) === 0) {
						$indexB = $i;
					}
					if ($indexA !== PHP_INT_MAX  && $indexB !== PHP_INT_MAX) {
						break;
					}
				}
				return $indexA > $indexB;
			});
			$imageId = $images[0]['fileid'];
			$this->setCover($imageId, $albumId);
			$return = true;
		}
		return $return;
	}

	/**
	 * Returns the count of albums an Artist is featured in
	 * @param integer $artistId
	 * @return integer
	 */
	public function countByArtist($artistId) {
		$sql = 'SELECT COUNT(*) AS count FROM '.
			'(SELECT DISTINCT `track`.`album_id` FROM '.
			'`*PREFIX*music_tracks` `track` WHERE `track`.`artist_id` = ? '.
			'UNION SELECT `album`.`id` FROM '.
			'`*PREFIX*music_albums` `album` WHERE `album`.`album_artist_id` = ?) tmp';
		$params = [$artistId, $artistId];
		$result = $this->execute($sql, $params);
		$row = $result->fetch();
		return $row['count'];
	}

	/**
	 * @param string $name
	 * @param string $userId
	 * @param bool $fuzzy
	 * @param integer $limit
	 * @param integer $offset
	 * @return Album[]
	 */
	public function findAllByName($name, $userId, $fuzzy = false, $limit=null, $offset=null) {
		if ($fuzzy) {
			$condition = 'AND LOWER(`album`.`name`) LIKE LOWER(?) ';
			$name = '%' . $name . '%';
		} else {
			$condition = 'AND `album`.`name` = ? ';
		}
		$sql = $this->makeSelectQuery($condition . 'ORDER BY LOWER(`album`.`name`)');
		$params = [$userId, $name];
		return $this->findEntities($sql, $params, $limit, $offset);
	}

	public function findUniqueEntity(Album $album) {
		return $this->findEntity(
				'SELECT * FROM `*PREFIX*music_albums` WHERE `user_id` = ? AND `hash` = ?',
				[$album->getUserId(), $album->getHash()]
		);
	}
}
