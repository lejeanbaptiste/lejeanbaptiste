import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, } from '@mui/material';
import { Formik } from 'formik';
import React from 'react';
import * as yup from 'yup';
import { useActions } from '../../overmind';
const initialValues = {
    name: '',
    cssUrl: '',
    xmlUrl: '',
};
const formValidation = yup.object().shape({
    name: yup.string().min(3).required('must be have at least ${min} chatacters'),
    cssUrl: yup.string().required().url('Must be a valid URL'),
    xmlUrl: yup.string().required().url('Must be a valid URL'),
});
const AddSchemaDialog = ({ handleClose, open }) => {
    const { editor } = useActions();
    const submit = (schema) => {
        editor.addShema(schema);
        handleClose();
    };
    const close = () => handleClose();
    return (React.createElement(Dialog, { "aria-labelledby": "form-dialog-title", onClose: close, open: open },
        React.createElement(DialogTitle, { id: "form-dialog-title" }, "Add Schema"),
        React.createElement(Formik, { enableReinitialize: true, initialValues: initialValues, onSubmit: submit, validationSchema: formValidation }, ({ errors, handleBlur, handleChange, handleSubmit, touched, values }) => (React.createElement("form", { onSubmit: handleSubmit },
            React.createElement(DialogContent, null,
                React.createElement(TextField, { autoFocus: true, error: Boolean(touched.name && errors.name), fullWidth: true, helperText: touched.name && errors.name, label: "Schema Name", margin: "dense", name: "name", onBlur: handleBlur, onChange: handleChange, value: values.name, variant: "standard" }),
                React.createElement(TextField, { error: Boolean(touched.xmlUrl && errors.xmlUrl), fullWidth: true, helperText: touched.xmlUrl && errors.xmlUrl, label: "Schema URL", margin: "dense", name: "xmlUrl", onBlur: handleBlur, onChange: handleChange, placeholder: "https://", value: values.xmlUrl, variant: "standard" }),
                React.createElement(TextField, { error: Boolean(touched.cssUrl && errors.cssUrl), fullWidth: true, helperText: touched.cssUrl && errors.cssUrl, label: "Schema CSS URL", margin: "dense", name: "cssUrl", onBlur: handleBlur, onChange: handleChange, placeholder: "https://", value: values.cssUrl, variant: "standard" })),
            React.createElement(DialogActions, null,
                React.createElement(Button, { onClick: close }, "Cancel"),
                React.createElement(Button, { type: "submit" }, "Add")))))));
};
export default AddSchemaDialog;
//# sourceMappingURL=AddSchemaDialog.js.map