import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, } from '@mui/material';
import { Formik } from 'formik';
import React from 'react';
import * as yup from 'yup';
import { useActions } from '../../overmind';
const formValidation = yup.object().shape({
    name: yup.string().min(3).required('must be have at least ${min} chatacters'),
    css: yup.string().required().url('Must be a valid URL'),
    rng: yup.string().required().url('Must be a valid URL'),
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
        React.createElement(Formik, { enableReinitialize: true, initialValues: { name: '', css: '', rng: '' }, onSubmit: (values) => {
                //convert css and schema urls into array
                const newSchema = { name: values.name, rng: [values.rng], css: [values.css] };
                submit(newSchema);
            }, validationSchema: formValidation }, ({ errors, handleBlur, handleChange, handleSubmit, touched, values }) => (React.createElement("form", { onSubmit: handleSubmit },
            React.createElement(DialogContent, null,
                React.createElement(TextField, { autoFocus: true, error: Boolean(touched.name && errors.name), fullWidth: true, helperText: touched.name && errors.name, label: "Schema Name", margin: "dense", name: "name", onBlur: handleBlur, onChange: handleChange, value: values.name, variant: "standard" }),
                React.createElement(TextField, { error: Boolean(touched.rng && errors.rng), fullWidth: true, helperText: touched.rng && errors.rng, label: "Schema URL", margin: "dense", name: "rng", onBlur: handleBlur, onChange: handleChange, placeholder: "https://", value: values.rng, variant: "standard" }),
                React.createElement(TextField, { error: Boolean(touched.css && errors.css), fullWidth: true, helperText: touched.css && errors.css, label: "Schema CSS URL", margin: "dense", name: "css", onBlur: handleBlur, onChange: handleChange, placeholder: "https://", value: values.css, variant: "standard" })),
            React.createElement(DialogActions, null,
                React.createElement(Button, { onClick: close }, "Cancel"),
                React.createElement(Button, { type: "submit" }, "Add")))))));
};
export default AddSchemaDialog;
//# sourceMappingURL=AddSchemaDialog.js.map