
// maximum names to match on
var MAX_NAMES = 10;

// maximum address records to return
var MAX_MATCHES = 3;

/**
  this query should only ever return max 3 rows.
  note: the amount of rows returned does not adequently indicate whether an
  exact match was found or not.
**/

var SQL = [
  'WITH base AS (',
    'SELECT address.* FROM street.rtree',
    'JOIN street.names ON street.names.id = street.rtree.id',
    'JOIN address ON address.id = street.rtree.id',
    'WHERE (',
      'street.rtree.minX<=?1 AND street.rtree.maxX>=?1 AND',
      'street.rtree.minY<=?2 AND street.rtree.maxY>=?2',
    ')',
    'AND ( %%NAME_CONDITIONS%% )',
    'AND address.id IN (',
      'SELECT address.id FROM address',
      'WHERE (',
        'address.housenumber <= "%%TARGET_HOUSENUMBER%%" OR',
        'address.housenumber >= "%%TARGET_HOUSENUMBER%%"',
      ')',
      'GROUP BY address.id',
      'HAVING( COUNT(*) > 1 )',
    ')',
    'ORDER BY address.housenumber ASC', // @warning business logic depends on this
  ')',
  'SELECT * FROM (',
    '(SELECT * FROM base WHERE housenumber < "%%TARGET_HOUSENUMBER%%" ORDER BY housenumber DESC LIMIT 1)',
  ') UNION SELECT * FROM (',
    '(SELECT * FROM base WHERE housenumber >= "%%TARGET_HOUSENUMBER%%" ORDER BY housenumber ASC LIMIT 2)',
  ')',
  'ORDER BY housenumber ASC', // @warning business logic depends on this
  'LIMIT %%MAX_MATCHES%%;'
].join(' ');

var NAME_SQL = '(street.names.name=?)';

module.exports = function( db, point, number, names, cb ){

  // error checking
  if( !names || !names.length ){
    return cb( null, [] );
  }

  // max conditions to search on
  var max = { names: Math.min( names.length, MAX_NAMES ) };

  // use named parameters to avoid sending coordinates twice for rtree conditions
  var position = 3; // 1 and 2 are used by lon and lat.

  // add name conditions to query
  var nameConditions = Array.apply(null, new Array(max.names)).map( function(){
    return NAME_SQL.replace('?', '?' + position++);
  });

  // build unique sql statement
  var sql = SQL.replace( '%%NAME_CONDITIONS%%', nameConditions.join(' OR ') )
               .replace( '%%MAX_MATCHES%%', MAX_MATCHES )
               .split( '%%TARGET_HOUSENUMBER%%' ).join( number );

  // create a variable array of params for the query
  var params = [ point.lon, point.lat ].concat( names.slice(0, max.names) );

  // execute query
  db.all( sql, params, cb );
};
