interface config {
	user: {                             // [Required] Uses to create annotations
		userID: string;                   // [Required] URI - ORCID, if available
		name: string;                     // [Required] Full name
		permissions?: string;             // [Optional] To manage (CRUP) entities
	};
	document: {                         // [Required] Working document
		uid: string;                      // [Required] URI - Current resource unique identifier
		xml: string;                      // [Required] RAW XML
	};
	editor?: {                          // [Optional] Configures the editor
		ui?: {                            // [Optional] Changes the appearance
			language?: string;              // [Optional] Language Code e.g., `en-CA`. Default: 'en-CA' (English). Options: 'en-CA' | 'fr-CA'
			colorScheme?: string;           // [Optional] Scheme name. Default: 'standard'. Options: 'standard'
		};
		functionalities?: {                // [Optional] Delimites functionalities
			supportedSchemas?: string[];      // [Optional] List of supported schemas' names. Default / options: ['cwrcTeiLite', 'orlando', 'event', 'cwrcEntry', 'epidoc', `teiAll`, 'teiDrama', 'teiCorpus', `teiMs', 'teiSpeech', 'teiLite', 'moravian', 'reed']
		};
		credentials?: {                   // [Optional] Access to external API services
			nssiToken?: string;             // [Optional] NSSI auth token
		};
		modules?: {                       // [Optional] Add modules
			validator?: Validator;          // [Optional] The module itself
			imageViewer?: ImageViewer;      // [Optional] The module itself
			Nerve?: Nerve;                  // [Optional] The module itself
		};
	};
	preferences?: {                      // [Optional] Customizes the space
		themeMode?: string;               // [Optional] Use dark/light mode. Default: 'auto' (follows the system). Options: 'auto' | 'light' | 'dark'
		fontSize?: number;                // [Optional] Changes the document's default font size. Default: 11. Options: 10-18
		workspace?: {                     // [Optional] Reorganize panels position in space. If present, both left and right side must be defined.
			leftSide: string[];             // [Required] List of panel names. Default: ['structure', 'nerve']
			rightSide: string[];            // [Required] List of panel names. Default: ['xml-viewer', 'image-viewer', 'validator']
		};
	};
}
