steal('can/util',
	  'can/view',
	  'can/view/scanner.js',
	  'can/observe/compute',
	  'can/view/render.js',
function( can ){

	can.view.ext = ".mustache";

	var extend = can.extend,
		Mustache = function( options ) {
			// Supports calling Mustache without the constructor
			// This returns a function that renders the template.
			if ( this.constructor != Mustache ) {
				var mustache = new Mustache(options);
				return function( data, helpers ) {
					 return mustache.render(data, helpers);
				};
			}

			// If we get a `function` directly, it probably is coming from
			// a `steal`-packaged view.
			if ( typeof options == "function" ) {
				this.template = {
					fn: options
				};
				return;
			}

			// Set options on self.
			extend(this, options);
			this.template = this.scanner.scan(this.text, this.name);
		};

	can.Mustache = window.Mustache = Mustache;

	/** 
	 * @Prototype
	 */
	Mustache.prototype.	 
	/**
	 * Renders an object with view helpers attached to the view.
	 * 
	 *		 new Mustache({text: "<%= message %>"}).render({
	 *			 message: "foo"
	 *		 },{helper: function(){ ... }})
	 *		 
	 * @param {Object} object data to be rendered
	 * @param {Object} [extraHelpers] an object with view helpers
	 * @return {String} returns the result of the string
	 */
	render = function( object, extraHelpers ) {
		object = object || {};
		return this.template.fn.call(object, object, new Mustache.Helpers(object, extraHelpers || {}));
	};

	extend(Mustache.prototype, {
		/**
		 * Singleton scanner instance for parsing templates.
		 */
		scanner: new can.view.Scanner({
			/**
			 * An ordered token registry for the scanner.
			 * This needs to be ordered by priority to prevent token parsing errors.
			 * Each token is defined as: ["token-name", "string representation", "optional regexp override"]
			 */
			tokens: [
				["templateLeft", "{{$"], // Template	 ---- Not supported
				["templateRight", "$}}"], // Right Template	---- Not supported
				["returnLeft", "{{{", "{{[{&]"], // Return Unescaped
				// ["commentFull", "{{!}}", "[\\s\\t]*{{!.+?}}\\n?"], // Comment
				["commentLeft", "{{!", "(\\n[\\s\\t]*{{!|{{!)"], // Comment
				["left", "{{~"], // Run
				["escapeLeft", "{{"], // Return Escaped
				["returnRight", "}}}"],
				["right", "}}"] // Right -> All have same FOR Mustache ...
			],

			helpers: can.extend(can.view.Scanner.prototype.helpers, {
				/**
				 * {{#evalvariable}}
				 * 
				 * ## Sections
				 * Sections render blocks of text one or more times, depending on the value 
				 * of the key in the current context.
				 *
				 * A section begins with a pound and ends with a slash. That is, {{#person}} 
				 * begins a "person" section while {{/person}} ends it.
				 *
				 * The behavior of the section is determined by the value of the key.
				 *
				 * ### False Values or Empty Lists
				 * If the person key exists and has a value of false or an empty list, the HTML 
				 * between the pound and slash will not be displayed.
				 *
				 * ### Non-Empty Lists
				 * If the person key exists and has a non-false value, the HTML between the pound 
				 * and slash will be rendered and displayed one or more times.
				 *
				 * When the value is a non-empty list, the text in the block will be displayed once for 
				 * each item in the list. The context of the block will be set to the current item for each 
				 * iteration. In this way we can loop over collections.
				 *
				 * ### Lambdas
				 * When the value is a callable object, such as a function or lambda, the object will be 
				 * invoked and passed the block of text. The text passed is the literal block, unrendered. 
				 * {{tags}} will not have been expanded - the lambda should do that on its own. In this way you 
				 * can implement filters or caching.
				 *
				 * @param {String} content
				 */
				if: function(content){
					var match = content.match(/^#\w*$/);
					if(match){
						return 'if(' + content.substring(1, content.length) + ') {';
					}

					return content;
				},

				/**
				 * {{#person?}}
				 * 
				 * ## Non-False Values
				 * When the value is non-false but not a list, it will be used as the context 
				 * for a single rendering of the block.
				 * 
				 * @param {String} content
				 */
				nonfalse: function(content){
					return content;
				},

				/**
				 * {{^ evalvariable }}
				 * 
				 * ## Inverted Sections
				 * An inverted section begins with a caret (hat) and ends with a slash. 
				 * That is {{^person}} begins a "person" inverted section while {{/person}} ends it.
				 * 
				 * @param {String} content
				 */
				inverted: function(content){
					return content;
				},

				/**
				 * {{/ evalvariable }}
				 * Closes sections.
				 * @param {String} content
				 */
				close: function(content){
					var match = content.match(/^\/\w*$/);
					if(match){
						return '};';
					}

					return content;
				},
				
				/**
				 * Basic Context Miss Interpolation
				 *  {{cannot}}
				 * 	Failed context lookups should default to empty strings.
				 * Dotted Names - Broken Chains
				 *	{{a.b.c}}
    			 * 	Any falsey value prior to the last part of the name should yield ''.
				 */
				cannot: function(content) {
					// match only words and dots
					var match = content.match(/^\w*[\.|\w]*$/);
					if(match && content.length){

						var split = content.split('.'),
						// Handle context miss
						result = ['(typeof ' + split[0] + ' != "undefined" ? '];

						// Handle broken chains
						if (split.length > 1) {
							result.push('(');
							for (var i = 1; i < split.length; i++) {
								i > 1 && result.push(' && ');
								result.push(split.slice(0, i+1).join('.'));
							}
							result.push(') || ""');
						}
						else {
							result.push(split[0]);
						}

						return result.concat([' : "")']).join('');
					}

					return content;
				}
			})
		})
	});

	Mustache.Helpers = function( data, extras ) {
		this._data = data;
		this._extras = extras;
		extend(this, extras);
	};

	Mustache.registerHelper = function(name, fn){
  		this.prototype.scanner.helpers[name] = fn;
	};

	/**
	 * Register the view.
	 */
	can.view.register({
		suffix: "mustache",

		contentType: "x-mustache-template",

		// returns a `function` that renders the view.
		script: function( id, src ) {
			return "can.Mustache(function(_CONTEXT,_VIEW) { " + new Mustache({
				text: src,
				name: id
			}).template.out + " })";
		},

		renderer: function( id, text ) {
			return Mustache({
				text: text,
				name: id
			});
		}
	});

});