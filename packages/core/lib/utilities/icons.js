import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ComputerIcon from '@mui/icons-material/Computer';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Gitlab } from 'mdi-material-ui';
import iconCitation from '../icons/citation.svg';
import titleIcon from '../icons/book-solid.svg';
import rsIcon from '../icons/box-open-solid.svg';
import validateIcon from '../icons/clipboard-check-solid.svg';
import codeIcon from '../icons/code-solid.svg';
import editIcon from '../icons/edit-solid.svg';
import EventIcon from '../icons/event.svg';
import markupFileIcon from '../icons/file-code-solid.svg';
import loadIcon from '../icons/folder-open-solid.svg';
import KeyIcon from '../icons/key.svg';
import LabelIcon from '../icons/label.svg';
import LinkIcon from '../icons/link.svg';
import iconPerson from '../icons/person.svg';
import PlaceIcon from '../icons/place.svg';
import relationIcon from '../icons/project-diagram-solid.svg';
import saveIcon from '../icons/save-solid.svg';
import signOutIcon from '../icons/sign-out-alt-solid.svg';
import NoteIcon from '../icons/sticky-note.svg';
import tagEditIcon from '../icons/tag-edit-solid.svg';
import tagRemoveIcon from '../icons/tag-remove-solid.svg';
import TranslationIcon from '../icons/translate.svg';
import triangleExclamationIcon from '../icons/triangle-exclamation-solid.svg';
import iconOrg from '../icons/users-solid.svg';
const icons = new Map([
    ['github', GitHubIcon],
    ['gitlab', Gitlab],
    ['fingerprint', FingerprintIcon],
    ['cloud', CloudQueueIcon],
    ['computer', ComputerIcon],
    ['paste', ContentPasteIcon],
]);
const svgs = new Map([
    ['tags', LabelIcon],
    ['person', iconPerson],
    ['place', PlaceIcon],
    ['title', titleIcon],
    ['date', EventIcon],
    ['organization', iconOrg],
    ['citation', iconCitation],
    ['note', NoteIcon],
    ['correction', triangleExclamationIcon],
    ['keyword', KeyIcon],
    ['link', LinkIcon],
    ['rs', rsIcon],
    ['translation', TranslationIcon],
    ['relation', relationIcon],
    ['tag-edit', tagEditIcon],
    ['tag-remove', tagRemoveIcon],
    ['code', codeIcon],
    ['markup-file', markupFileIcon],
    ['edit', editIcon],
    ['validate', validateIcon],
    ['save', saveIcon],
    ['load', loadIcon],
    ['sign-out', signOutIcon],
]);
export const getIcon = (name) => {
    const icon = icons.get(name);
    if (!icon)
        return FingerprintIcon;
    return icon;
};
export const getSvg = (name) => {
    const icon = svgs.get(name);
    if (!icon)
        return LabelIcon;
    return icon;
};
//# sourceMappingURL=icons.js.map