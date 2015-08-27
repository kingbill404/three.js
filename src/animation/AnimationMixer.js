/**
 *
 * Mixes together the AnimationClips scheduled by AnimationActions and applies them to the root and subtree
 *
 *
 * @author Ben Houston / http://clara.io/
 * @author David Sarno / http://lighthaus.us/
 */

THREE.AnimationMixer = function( root ) {

	this.root = root;
	this.time = 0;
	this.timeScale = 1.0;
	this.actions = [];
	this.propertyBindings = [];

};

THREE.AnimationMixer.prototype = {

	constructor: THREE.AnimationMixer,

	addAction: function( action ) {

		this.actions.push( action );
		action.mixer = this;

		var tracks = action.clip.tracks;

		for( var i = 0; i < tracks.length; i ++ ) {

			var track = tracks[ i ];

			var j = this.getPropertyBindingIndex( track.name )

			var propertyBinding;

			if( j < 0 ) {
			
				propertyBinding = new THREE.PropertyBinding( this.root, track.name );
				this.propertyBindings.push( propertyBinding );
			
			}
			else {
				propertyBinding = this.propertyBindings[ j ];
			}
			
			// track usages of shared property bindings, because if we leave too many around, the mixer can get slow
			propertyBinding.referenceCount += 1;

		}

		this.updatePropertyBindingIndices();

	},

	getPropertyBindingIndex: function( trackName ) {
		
		for( var k = 0; k < this.propertyBindings.length; k ++ ) {
			if( this.propertyBindings[k].trackName === trackName ) {
				return k;
			}
		}	

		return -1;

	},

	updatePropertyBindingIndices: function() {

		for( var i = 0; i < this.actions.length; i++ ) {

			var action = this.actions[i];

			var propertyBindingIndices = [];

			for( var j = 0; j < action.clip.tracks.length; j ++ ) {

				var trackName = action.clip.tracks[j].name;
				propertyBindingIndices.push( this.getPropertyBindingIndex( trackName ) );
			
			}

			action.propertyBindingIndices = propertyBindingIndices;
		}

	},

	removeAllActions: function() {

		for( var i = 0; i < this.actions.length; i ++ ) {

			this.actions[i].mixer = null;
			
		}

		// unbind all property bindings
		for( var i = 0; i < this.propertyBindings.length; i ++ ) {

			this.propertyBindings[i].unbind();

		}

		this.actions = [];
		this.propertyBindings = [];

		return this;

	},

	removeAction: function( action ) {

		var index = this.actions.indexOf( action );

		if ( index !== - 1 ) {

			this.actions.splice( index, 1 );
			action.mixer = null;

		}

		// remove unused property bindings because if we leave them around the mixer can get slow
		var tracks = action.clip.tracks;

		for( var i = 0; i < tracks.length; i ++ ) {
		
			var track = tracks[ i ];
			var propertyBindingIndex = this.getPropertyBindingIndex( track.name );
			var propertyBinding = this.propertyBindings[ propertyBindingIndex ];

			propertyBinding.referenceCount -= 1;

			if( propertyBinding.referenceCount <= 0 ) {

				propertyBinding.unbind();

				this.propertyBindings.splice( this.propertyBindings.indexOf( propertyBinding ), 1 );

			}
		}

		this.updatePropertyBindingIndices();

		return this;

	},

	play: function( action, optionalFadeInDuration ) {

		action.startTime = this.time;
		this.addAction( action );

		return this;

	},

	fadeOut: function( action, duration ) {

		var keys = [];

		keys.push( { time: this.time, value: 1 } );
		keys.push( { time: this.time + duration, value: 0 } );
		
		action.weight = new THREE.NumberKeyframeTrack( "weight", keys );

		return this;

	},

	fadeIn: function( action, duration ) {
		
		var keys = [];
		
		keys.push( { time: this.time, value: 0 } );
		keys.push( { time: this.time + duration, value: 1 } );
		
		action.weight = new THREE.NumberKeyframeTrack( "weight", keys );

		return this;

	},

	warp: function( action, startTimeScale, endTimeScale, duration ) {

		var keys = [];
		
		keys.push( { time: this.time, value: startTimeScale } );
		keys.push( { time: this.time + duration, value: endTimeScale } );
		
		action.timeScale = new THREE.NumberKeyframeTrack( "timeScale", keys );

		return this;

	},

	crossFade: function( fadeOutAction, fadeInAction, duration, warp ) {

		this.fadeOut( fadeOutAction, duration );
		this.fadeIn( fadeInAction, duration );

		if( warp ) {
	
			var startEndRatio = fadeOutAction.clip.duration / fadeInAction.clip.duration;
			var endStartRatio = 1.0 / startEndRatio;

			this.warp( fadeOutAction, 1.0, startEndRatio, duration );
			this.warp( fadeInAction, endStartRatio, 1.0, duration );

		}

		return this;
		
	},

	update: function( deltaTime ) {

		var mixerDeltaTime = deltaTime * this.timeScale;
		this.time += mixerDeltaTime;

		for( var i = 0; i < this.actions.length; i ++ ) {

			var action = this.actions[i];

			var weight = action.getWeightAt( this.time );

			var actionTimeScale = action.getTimeScaleAt( this.time );
			var actionDeltaTime = mixerDeltaTime * actionTimeScale;
		
			var actionResults = action.update( actionDeltaTime );

			if( action.weight <= 0 || ! action.enabled ) continue;

			for( var j = 0; j < actionResults.length; j ++ ) {

				var name = action.clip.tracks[j].name;

				this.propertyBindings[ action.propertyBindingIndices[ j ] ].accumulate( actionResults[j], weight );

			}

		}
	
		// apply to nodes
		for ( var i = 0; i < this.propertyBindings.length; i ++ ) {

			this.propertyBindings[ i ].apply();

		}

		return this;
		
	}

};

THREE.EventDispatcher.prototype.apply( THREE.AnimationMixer.prototype );
